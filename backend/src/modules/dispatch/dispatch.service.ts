// ============================================================
// UyirKappan — Intelligent Dispatch Service
// The main orchestrator — receives a dispatch request,
// discovers candidates, routes via Dijkstra, scores, and
// returns the best ambulance (or NO_AMBULANCE_AVAILABLE).
// ============================================================

import pool from "../../config/database.js";
import { loadRoadGraph } from "../routing/graph.service.js";
import { dijkstra } from "../routing/dijkstra.service.js";

import { findAvailableCandidates } from "./candidate.service.js";

import {
  scoreCandidates,
  dominantTrafficOnRoute
} from "./scoring.service.js";

import type {
  DispatchRequest,
  DispatchResult,
  DispatchDecision,
  DispatchConfig,
  CandidateAmbulance,
  ScoredCandidate
} from "./dispatch.types.js";

import {
  DEFAULT_DISPATCH_CONFIG
} from "./dispatch.types.js";

import type { RoadGraph } from "../routing/graph.types.js";
import type { DijkstraResult } from "../routing/dijkstra.service.js";


// ----- Nearest-node helper (same strategy as routing.service) -----

async function findNearestNodeId(
  location: { latitude: number; longitude: number }
): Promise<string> {

  const result = await pool.query(
    `
    SELECT node_id
    FROM road_nodes
    ORDER BY location <-> ST_SetSRID(
      ST_MakePoint($1, $2), 4326
    )::geography
    LIMIT 1
    `,
    [location.longitude, location.latitude]
  );

  if (result.rows.length === 0) {
    throw new Error(
      "No road node found near the given location"
    );
  }

  return result.rows[0].node_id;
}


/**
 * Find the nearest node for an ambulance's current GPS position.
 */
async function findNearestNodeForAmbulance(
  ambulanceId: string
): Promise<string> {

  const result = await pool.query(
    `
    SELECT rn.node_id
    FROM ambulances a
    CROSS JOIN LATERAL (
      SELECT node_id
      FROM road_nodes
      ORDER BY location <-> a.current_location
      LIMIT 1
    ) rn
    WHERE a.ambulance_id = $1
    `,
    [ambulanceId]
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Cannot find nearest node for ambulance ${ambulanceId}`
    );
  }

  return result.rows[0].node_id;
}


// ============================================================
// INTELLIGENT DISPATCH
// ============================================================

/**
 * Run the full intelligent dispatch pipeline:
 *
 * 1. Discover available candidates (DB query with spatial filter)
 * 2. Load the road graph (nodes, edges, traffic weights)
 * 3. For each candidate → find nearest node → Dijkstra to pickup
 * 4. Score each candidate using the weighted formula
 * 5. Return the best candidate (or NO_AMBULANCE_AVAILABLE)
 *
 * The engine is **stateless** — it can be called multiple times
 * for the same request with different `excludedAmbulances`.
 */
export async function runIntelligentDispatch(
  request: DispatchRequest,
  config: DispatchConfig = DEFAULT_DISPATCH_CONFIG
): Promise<DispatchResult> {

  const startTime = performance.now();

  // ---- 1. Discover candidates ----
  const candidates = await findAvailableCandidates(
    request.pickupLocation,
    request.excludedAmbulances,
    { searchRadiusMeters: config.searchRadiusMeters }
  );

  if (candidates.length === 0) {
    return {
      requestId: request.requestId,
      status: "NO_AMBULANCE_AVAILABLE",
      reason:
        request.excludedAmbulances.length > 0
          ? `No available ambulances remaining after excluding ${request.excludedAmbulances.length} previous attempt(s).`
          : "No available ambulances found within the search radius."
    };
  }

  // ---- 2. Load road graph ----
  const graph = await loadRoadGraph();

  // ---- 3. Find pickup node ----
  const pickupNodeId = await findNearestNodeId(
    request.pickupLocation
  );

  // ---- 4. Route each candidate ----
  const routeInfos: {
    candidate: CandidateAmbulance;
    dijkstraResult: DijkstraResult;
    dominantTrafficState: import("../routing/graph.types.js").TrafficState;
  }[] = [];

  const routeFailures: string[] = [];

  for (const candidate of candidates) {
    try {
      const ambNodeId =
        await findNearestNodeForAmbulance(
          candidate.ambulanceId
        );

      const result = dijkstra(
        graph,
        ambNodeId,
        pickupNodeId
      );

      if (!result) {
        routeFailures.push(
          `${candidate.ambulanceCode}: no route to pickup`
        );
        continue;
      }

      const dominantTrafficState =
        dominantTrafficOnRoute(result.path, graph);

      routeInfos.push({
        candidate,
        dijkstraResult: result,
        dominantTrafficState
      });
    } catch {
      routeFailures.push(
        `${candidate.ambulanceCode}: routing error`
      );
    }
  }

  if (routeInfos.length === 0) {
    return {
      requestId: request.requestId,
      status: "NO_AMBULANCE_AVAILABLE",
      reason:
        `Found ${candidates.length} candidate(s) but none had a valid route. ` +
        routeFailures.join("; ")
    };
  }

  // ---- 5. Score & rank ----
  const scoredCandidates = scoreCandidates(
    routeInfos,
    config.weights
  );

  const best = scoredCandidates[0];

  const elapsed = Math.round(
    performance.now() - startTime
  );

  console.log(
    `[Dispatch] Selected ${best.ambulanceCode} ` +
    `(score ${best.score}, ETA ${best.estimatedTravelTimeMinutes.toFixed(1)} min, ` +
    `${best.distanceKm.toFixed(2)} km) in ${elapsed} ms`
  );

  // ---- 6. Return decision ----
  const decision: DispatchDecision = {
    requestId: request.requestId,
    ambulanceId: best.ambulanceId,
    ambulanceCode: best.ambulanceCode,

    estimatedTravelTime:
      Math.round(best.estimatedTravelTimeMinutes * 10) / 10,

    distance:
      Math.round(best.distanceKm * 100) / 100,

    score: best.score,
    route: best.route,
    trafficCondition: best.trafficCondition,
    explanation: best.explanation,
    candidates: scoredCandidates
  };

  return decision;
}


// ============================================================
// BASELINE DISPATCH (for comparison)
// ============================================================

/**
 * Simple baseline: find all AVAILABLE ambulances, calculate
 * straight-line distance, pick the nearest.  No routing, no
 * traffic, no scoring.
 */
export async function runBaselineDispatch(
  request: DispatchRequest,
  config: DispatchConfig = DEFAULT_DISPATCH_CONFIG
): Promise<DispatchResult> {

  const candidates = await findAvailableCandidates(
    request.pickupLocation,
    request.excludedAmbulances,
    { searchRadiusMeters: config.searchRadiusMeters }
  );

  if (candidates.length === 0) {
    return {
      requestId: request.requestId,
      status: "NO_AMBULANCE_AVAILABLE",
      reason: "No available ambulances found (baseline)."
    };
  }

  // Nearest by straight-line distance (already sorted by the query)
  const best = candidates[0];

  const distanceKm =
    best.straightLineDistanceMeters / 1000;

  // Estimate travel time at 40 km/h
  const estimatedMinutes =
    (distanceKm / 40) * 60;

  return {
    requestId: request.requestId,
    ambulanceId: best.ambulanceId,
    ambulanceCode: best.ambulanceCode,

    estimatedTravelTime:
      Math.round(estimatedMinutes * 10) / 10,

    distance:
      Math.round(distanceKm * 100) / 100,

    score: 0,
    route: [],
    trafficCondition: "NORMAL",

    explanation:
      `Baseline: selected nearest ambulance ` +
      `${best.ambulanceCode} at ` +
      `${distanceKm.toFixed(2)} km straight-line distance.`,

    candidates: []
  };
}
