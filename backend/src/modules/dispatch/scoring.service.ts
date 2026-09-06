// ============================================================
// UyirKappan — Candidate Scoring Service
// Calculates weighted scores for dispatch candidates
// ============================================================

import type { TrafficState } from "../routing/graph.types.js";
import type { GraphEdge } from "../routing/graph.types.js";

import type {
  ScoredCandidate,
  ScoringWeights,
  CandidateAmbulance
} from "./dispatch.types.js";

import {
  DEFAULT_SCORING_WEIGHTS,
  TRAFFIC_MULTIPLIERS
} from "./dispatch.types.js";

import type {
  DijkstraResult
} from "../routing/dijkstra.service.js";

import type { RoadGraph } from "../routing/graph.types.js";


// ----- Internal types -----

interface CandidateRouteInfo {
  candidate: CandidateAmbulance;
  dijkstraResult: DijkstraResult;

  /** Dominant traffic state along the route. */
  dominantTrafficState: TrafficState;
}


// ----- Score calculation -----

/**
 * Compute a numeric traffic penalty from the dominant state.
 * 0 = NORMAL (best), 1 = MODERATE, 2 = HEAVY.
 * BLOCKED routes never reach scoring because Dijkstra skips them.
 */
function trafficPenalty(state: TrafficState): number {
  switch (state) {
    case "NORMAL":   return 0;
    case "MODERATE": return 1;
    case "HEAVY":    return 2;
    case "BLOCKED":  return 3;
    default:         return 0;
  }
}


/**
 * Determine the dominant (worst) traffic state on a route by
 * inspecting every edge the path traverses.
 */
export function dominantTrafficOnRoute(
  path: string[],
  graph: RoadGraph
): TrafficState {

  const ORDER: TrafficState[] = [
    "NORMAL",
    "MODERATE",
    "HEAVY",
    "BLOCKED"
  ];

  let worst = 0; // index into ORDER

  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId = path[i + 1];

    const edges =
      graph.adjacencyList.get(fromId) ?? [];

    const edge = edges.find(e => e.to === toId);

    if (edge) {
      const idx = ORDER.indexOf(
        edge.trafficState
      );

      if (idx > worst) {
        worst = idx;
      }
    }
  }

  return ORDER[worst];
}


/**
 * Score a list of candidate-route pairs and return them ranked
 * best (lowest score) to worst.
 *
 * **Scoring formula** (all values are normalised 0 – 1 before
 * weighting so no single factor dominates):
 *
 *   score = w_t × normTravelTime
 *         + w_d × normDistance
 *         + w_r × normTraffic
 *         + w_a × normAvailability
 *
 * `normAvailability` is always 0 for AVAILABLE ambulances in
 * the current implementation — the column exists for future
 * capability-based scoring.
 */
export function scoreCandidates(
  routeInfos: CandidateRouteInfo[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ScoredCandidate[] {

  if (routeInfos.length === 0) {
    return [];
  }

  // ----- Collect raw values -----
  const raw = routeInfos.map(info => {
    const travelTimeSec =
      info.dijkstraResult.travelTimeSeconds;

    const distanceMeters =
      info.dijkstraResult.distanceMeters;

    const traffic =
      trafficPenalty(info.dominantTrafficState);

    // Base travel time = distance / assumed 40 km/h ambulance speed
    const baseTravelTimeSec =
      (distanceMeters / 1000) / 40 * 3600;

    return {
      info,
      travelTimeSec,
      distanceMeters,
      baseTravelTimeSec,
      traffic
    };
  });

  // ----- Find max values for normalisation -----
  const maxTravelTime = Math.max(
    ...raw.map(r => r.travelTimeSec),
    1
  );

  const maxDistance = Math.max(
    ...raw.map(r => r.distanceMeters),
    1
  );

  const maxTraffic = Math.max(
    ...raw.map(r => r.traffic),
    1
  );

  // ----- Compute weighted score -----
  const scored: ScoredCandidate[] = raw.map(r => {
    const normTravelTime =
      r.travelTimeSec / maxTravelTime;

    const normDistance =
      r.distanceMeters / maxDistance;

    const normTraffic =
      r.traffic / maxTraffic;

    const normAvailability = 0; // all are AVAILABLE

    const score =
      weights.travelTime * normTravelTime +
      weights.distance * normDistance +
      weights.traffic * normTraffic +
      weights.availability * normAvailability;

    const distanceKm =
      r.distanceMeters / 1000;

    const estimatedTravelTimeMinutes =
      r.travelTimeSec / 60;

    const baseTravelTimeMinutes =
      r.baseTravelTimeSec / 60;

    // ----- Build explanation -----
    const parts: string[] = [];

    parts.push(
      `Route distance: ${distanceKm.toFixed(2)} km`
    );

    parts.push(
      `ETA: ${estimatedTravelTimeMinutes.toFixed(1)} min ` +
      `(base ${baseTravelTimeMinutes.toFixed(1)} min)`
    );

    if (
      r.info.dominantTrafficState !== "NORMAL"
    ) {
      parts.push(
        `Traffic: ${r.info.dominantTrafficState} — ` +
        `increased ETA from ` +
        `${baseTravelTimeMinutes.toFixed(1)} to ` +
        `${estimatedTravelTimeMinutes.toFixed(1)} minutes`
      );
    }

    return {
      ambulanceId:
        r.info.candidate.ambulanceId,

      ambulanceCode:
        r.info.candidate.ambulanceCode,

      distanceKm,
      estimatedTravelTimeMinutes,
      baseTravelTimeMinutes,
      score: Math.round(score * 10000) / 10000,
      route: r.info.dijkstraResult.pathNodeCodes,

      trafficCondition:
        r.info.dominantTrafficState,

      explanation: parts.join(". ")
    };
  });

  // ----- Sort best (lowest score) to worst -----
  scored.sort((a, b) => a.score - b.score);

  return scored;
}
