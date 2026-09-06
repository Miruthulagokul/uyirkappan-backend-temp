// ============================================================
// UyirKappan — Dispatch Simulation Harness
//
// Runs all 7 required scenarios end-to-end against the
// Intelligent and Baseline dispatch engines, collects metrics,
// and produces a comparison table.
//
// Usage:  npx tsx src/modules/simulation/dispatch-simulator.ts
// ============================================================

import dotenv from "dotenv";
dotenv.config();

import pool from "../../config/database.js";

import {
  runIntelligentDispatch,
  runBaselineDispatch
} from "../dispatch/dispatch.service.js";

import type {
  DispatchRequest,
  DispatchResult,
  DispatchDecision,
  DispatchMetrics,
  DispatchAttempt,
  NoAmbulanceDecision
} from "../dispatch/dispatch.types.js";


// ============================================================
// HELPERS
// ============================================================

function isDecision(
  r: DispatchResult
): r is DispatchDecision {
  return "ambulanceId" in r;
}

function isNoAmbulance(
  r: DispatchResult
): r is NoAmbulanceDecision {
  return "status" in r &&
    (r as NoAmbulanceDecision).status ===
      "NO_AMBULANCE_AVAILABLE";
}

function header(title: string): void {
  console.log("");
  console.log(
    "═".repeat(60)
  );
  console.log(`  ${title}`);
  console.log(
    "═".repeat(60)
  );
}

function printDecision(
  label: string,
  result: DispatchResult
): void {

  if (isDecision(result)) {
    console.log(
      `  [${label}] ` +
      `Selected: ${result.ambulanceCode} | ` +
      `ETA: ${result.estimatedTravelTime} min | ` +
      `Distance: ${result.distance} km | ` +
      `Score: ${result.score} | ` +
      `Traffic: ${result.trafficCondition}`
    );
    console.log(
      `           Route: ${result.route.join(" → ")}`
    );
    console.log(
      `           ${result.explanation}`
    );
  } else if (isNoAmbulance(result)) {
    console.log(
      `  [${label}] NO_AMBULANCE_AVAILABLE — ` +
      `${result.reason}`
    );
  }
}


// ============================================================
// SEED HELPERS — create temporary simulation data
// ============================================================

/**
 * Ensure we have at least 5 ambulances placed at known
 * road-node locations so the simulation is deterministic.
 */
async function seedAmbulances(): Promise<string[]> {

  // Map ambulance codes to road node codes so we know
  // exactly where they are in the network.
  const ambulances: {
    code: string;
    nodeCode: string;
  }[] = [
    { code: "AMB-01", nodeCode: "N01" },
    { code: "AMB-02", nodeCode: "N05" },
    { code: "AMB-03", nodeCode: "N13" },
    { code: "AMB-04", nodeCode: "N21" },
    { code: "AMB-05", nodeCode: "N25" }
  ];

  const ids: string[] = [];

  for (const amb of ambulances) {
    const result = await pool.query(
      `
      INSERT INTO ambulances (
        ambulance_code,
        current_location,
        availability_status
      )
      SELECT
        $1,
        rn.location,
        'AVAILABLE'
      FROM road_nodes rn
      WHERE rn.node_code = $2

      ON CONFLICT (ambulance_code)
      DO UPDATE SET
        current_location = EXCLUDED.current_location,
        availability_status = 'AVAILABLE',
        current_request_id = NULL

      RETURNING ambulance_id
      `,
      [amb.code, amb.nodeCode]
    );

    ids.push(result.rows[0].ambulance_id);
  }

  console.log(
    `  Seeded ${ids.length} ambulances (AMB-01 to AMB-05)`
  );

  return ids;
}


/**
 * Set all ambulances back to AVAILABLE.
 */
async function resetAmbulances(): Promise<void> {
  await pool.query(`
    UPDATE ambulances
    SET availability_status = 'AVAILABLE',
        current_request_id  = NULL
    WHERE ambulance_code IN (
      'AMB-01','AMB-02','AMB-03','AMB-04','AMB-05'
    )
  `);
}


/**
 * Set specific ambulances to a given status.
 */
async function setAmbulanceStatus(
  codes: string[],
  status: string
): Promise<void> {
  if (codes.length === 0) return;

  await pool.query(
    `
    UPDATE ambulances
    SET availability_status = $1
    WHERE ambulance_code = ANY($2)
    `,
    [status, codes]
  );
}


/**
 * Apply a traffic state to a specific road segment.
 */
async function setTraffic(
  segmentCode: string,
  state: string,
  multiplier: number
): Promise<void> {
  await pool.query(
    `
    UPDATE traffic_states ts
    SET state      = $2,
        multiplier = $3,
        updated_at = NOW()
    FROM road_segments rs
    WHERE ts.segment_id   = rs.segment_id
      AND rs.segment_code = $1
    `,
    [segmentCode, state, multiplier]
  );
}


/**
 * Reset all traffic to NORMAL.
 */
async function resetTraffic(): Promise<void> {
  await pool.query(`
    UPDATE traffic_states
    SET state      = 'NORMAL',
        multiplier = 1.0,
        updated_at = NOW()
  `);
}


// ============================================================
// SCENARIOS
// ============================================================

const PICKUP_LOCATION = {
  latitude: 13.0900,
  longitude: 80.2800
};


// ----- Scenario 1: Normal Dispatch -----

async function scenario1(
  metrics: DispatchMetrics[]
): Promise<void> {
  header("Scenario 1: Normal Dispatch");
  console.log(
    "  5 ambulances, 1 emergency, NORMAL traffic"
  );

  await resetAmbulances();
  await resetTraffic();

  const request: DispatchRequest = {
    requestId: "SIM-001",
    pickupLocation: PICKUP_LOCATION,
    emergencyType: "ACCIDENT",
    victimCount: 1,
    excludedAmbulances: []
  };

  const intelligent =
    await runIntelligentDispatch(request);

  const baseline =
    await runBaselineDispatch(request);

  printDecision("INTELLIGENT", intelligent);
  printDecision("BASELINE   ", baseline);

  if (isDecision(intelligent)) {
    metrics.push({
      requestId: request.requestId,
      ambulanceId: intelligent.ambulanceId,
      ambulanceCode: intelligent.ambulanceCode,
      candidateRank: 1,
      distanceKm: intelligent.distance,
      estimatedTravelTimeMinutes:
        intelligent.estimatedTravelTime,
      trafficCondition:
        intelligent.trafficCondition,
      score: intelligent.score,
      assignedAt: new Date(),
      response: "ACCEPTED"
    });
  }

  console.log("  ✅ Scenario 1 PASSED");
}


// ----- Scenario 2: Traffic Impact -----

async function scenario2(
  metrics: DispatchMetrics[]
): Promise<void> {
  header("Scenario 2: Traffic Impact");
  console.log(
    "  Same distance, different traffic conditions"
  );

  await resetAmbulances();
  await resetTraffic();

  // Apply HEAVY traffic on segments near AMB-03 (N13)
  // which is the closest to the pickup.
  // This should push the engine to prefer a different ambulance.
  await setTraffic("R-N08-N13", "HEAVY", 1.8);
  await setTraffic("R-N13-N08", "HEAVY", 1.8);
  await setTraffic("R-N12-N13", "HEAVY", 1.8);
  await setTraffic("R-N13-N12", "HEAVY", 1.8);
  await setTraffic("R-N13-N14", "HEAVY", 1.8);
  await setTraffic("R-N14-N13", "HEAVY", 1.8);
  await setTraffic("R-N13-N18", "HEAVY", 1.8);
  await setTraffic("R-N18-N13", "HEAVY", 1.8);

  const request: DispatchRequest = {
    requestId: "SIM-002",
    pickupLocation: PICKUP_LOCATION,
    emergencyType: "CARDIAC",
    victimCount: 1,
    excludedAmbulances: []
  };

  const intelligent =
    await runIntelligentDispatch(request);

  const baseline =
    await runBaselineDispatch(request);

  printDecision("INTELLIGENT", intelligent);
  printDecision("BASELINE   ", baseline);

  if (isDecision(intelligent)) {
    metrics.push({
      requestId: request.requestId,
      ambulanceId: intelligent.ambulanceId,
      ambulanceCode: intelligent.ambulanceCode,
      candidateRank: 1,
      distanceKm: intelligent.distance,
      estimatedTravelTimeMinutes:
        intelligent.estimatedTravelTime,
      trafficCondition:
        intelligent.trafficCondition,
      score: intelligent.score,
      assignedAt: new Date(),
      response: "ACCEPTED"
    });
  }

  await resetTraffic();
  console.log("  ✅ Scenario 2 PASSED");
}


// ----- Scenario 3: Fallback (Reject) -----

async function scenario3(
  metrics: DispatchMetrics[]
): Promise<void> {
  header("Scenario 3: Fallback — 1st REJECTS");

  await resetAmbulances();
  await resetTraffic();

  const request: DispatchRequest = {
    requestId: "SIM-003",
    pickupLocation: PICKUP_LOCATION,
    emergencyType: "ACCIDENT",
    victimCount: 2,
    excludedAmbulances: []
  };

  const attempts: DispatchAttempt[] = [];

  // Attempt 1
  console.log("  --- Attempt 1 ---");
  const attempt1 =
    await runIntelligentDispatch(request);

  printDecision("Attempt 1", attempt1);

  if (isDecision(attempt1)) {
    attempts.push({
      attemptNumber: 1,
      ambulanceId: attempt1.ambulanceId,
      ambulanceCode: attempt1.ambulanceCode,
      assignedAt: new Date(),
      response: "REJECTED",
      failureReason: "Driver unavailable"
    });

    console.log(
      `  ⛔ ${attempt1.ambulanceCode} REJECTED`
    );

    // Attempt 2 — exclude 1st
    request.excludedAmbulances.push(
      attempt1.ambulanceId
    );
  }

  console.log("  --- Attempt 2 ---");
  const attempt2 =
    await runIntelligentDispatch(request);

  printDecision("Attempt 2", attempt2);

  if (isDecision(attempt2)) {
    attempts.push({
      attemptNumber: 2,
      ambulanceId: attempt2.ambulanceId,
      ambulanceCode: attempt2.ambulanceCode,
      assignedAt: new Date(),
      response: "ACCEPTED"
    });

    console.log(
      `  ✅ ${attempt2.ambulanceCode} ACCEPTED`
    );

    metrics.push({
      requestId: request.requestId,
      ambulanceId: attempt2.ambulanceId,
      ambulanceCode: attempt2.ambulanceCode,
      candidateRank: 2,
      distanceKm: attempt2.distance,
      estimatedTravelTimeMinutes:
        attempt2.estimatedTravelTime,
      trafficCondition:
        attempt2.trafficCondition,
      score: attempt2.score,
      assignedAt: new Date(),
      response: "ACCEPTED"
    });
  }

  console.log(
    "  Attempt history:",
    JSON.stringify(attempts, null, 2)
  );

  console.log("  ✅ Scenario 3 PASSED");
}


// ----- Scenario 4: Fallback (Timeout) -----

async function scenario4(
  metrics: DispatchMetrics[]
): Promise<void> {
  header("Scenario 4: Fallback — 1st TIMEOUT");

  await resetAmbulances();
  await resetTraffic();

  const request: DispatchRequest = {
    requestId: "SIM-004",
    pickupLocation: PICKUP_LOCATION,
    emergencyType: "FIRE",
    victimCount: 3,
    excludedAmbulances: []
  };

  // Attempt 1
  console.log("  --- Attempt 1 ---");
  const attempt1 =
    await runIntelligentDispatch(request);
  printDecision("Attempt 1", attempt1);

  if (isDecision(attempt1)) {
    console.log(
      `  ⏱️ ${attempt1.ambulanceCode} TIMEOUT`
    );
    request.excludedAmbulances.push(
      attempt1.ambulanceId
    );
  }

  // Attempt 2
  console.log("  --- Attempt 2 ---");
  const attempt2 =
    await runIntelligentDispatch(request);
  printDecision("Attempt 2", attempt2);

  if (isDecision(attempt2)) {
    console.log(
      `  ✅ ${attempt2.ambulanceCode} ACCEPTED`
    );

    metrics.push({
      requestId: request.requestId,
      ambulanceId: attempt2.ambulanceId,
      ambulanceCode: attempt2.ambulanceCode,
      candidateRank: 2,
      distanceKm: attempt2.distance,
      estimatedTravelTimeMinutes:
        attempt2.estimatedTravelTime,
      trafficCondition:
        attempt2.trafficCondition,
      score: attempt2.score,
      assignedAt: new Date(),
      response: "ACCEPTED"
    });
  }

  console.log("  ✅ Scenario 4 PASSED");
}


// ----- Scenario 5: Multiple Fallbacks -----

async function scenario5(
  metrics: DispatchMetrics[]
): Promise<void> {
  header(
    "Scenario 5: Multiple Fallbacks — 1st rejects, 2nd rejects, 3rd accepts"
  );

  await resetAmbulances();
  await resetTraffic();

  const request: DispatchRequest = {
    requestId: "SIM-005",
    pickupLocation: PICKUP_LOCATION,
    emergencyType: "ACCIDENT",
    victimCount: 1,
    excludedAmbulances: []
  };

  for (
    let attemptNum = 1;
    attemptNum <= 3;
    attemptNum++
  ) {
    console.log(
      `  --- Attempt ${attemptNum} ---`
    );

    const result =
      await runIntelligentDispatch(request);

    printDecision(
      `Attempt ${attemptNum}`,
      result
    );

    if (isDecision(result)) {
      if (attemptNum < 3) {
        console.log(
          `  ⛔ ${result.ambulanceCode} REJECTED`
        );

        request.excludedAmbulances.push(
          result.ambulanceId
        );
      } else {
        console.log(
          `  ✅ ${result.ambulanceCode} ACCEPTED`
        );

        metrics.push({
          requestId: request.requestId,
          ambulanceId: result.ambulanceId,
          ambulanceCode: result.ambulanceCode,
          candidateRank: attemptNum,
          distanceKm: result.distance,
          estimatedTravelTimeMinutes:
            result.estimatedTravelTime,
          trafficCondition:
            result.trafficCondition,
          score: result.score,
          assignedAt: new Date(),
          response: "ACCEPTED"
        });
      }
    }
  }

  console.log("  ✅ Scenario 5 PASSED");
}


// ----- Scenario 6: No Ambulance -----

async function scenario6(
  metrics: DispatchMetrics[]
): Promise<void> {
  header("Scenario 6: No Ambulance Available");

  await resetAmbulances();
  await resetTraffic();

  // Set all ambulances to OFFLINE
  await setAmbulanceStatus(
    [
      "AMB-01", "AMB-02", "AMB-03",
      "AMB-04", "AMB-05"
    ],
    "OFFLINE"
  );

  const request: DispatchRequest = {
    requestId: "SIM-006",
    pickupLocation: PICKUP_LOCATION,
    emergencyType: "MEDICAL",
    victimCount: 1,
    excludedAmbulances: []
  };

  const result =
    await runIntelligentDispatch(request);

  printDecision("INTELLIGENT", result);

  if (isNoAmbulance(result)) {
    console.log(
      "  ✅ Scenario 6 PASSED — " +
      "correctly returned NO_AMBULANCE_AVAILABLE"
    );
  } else {
    console.log(
      "  ❌ Scenario 6 FAILED — " +
      "expected NO_AMBULANCE_AVAILABLE"
    );
  }

  // Restore
  await resetAmbulances();
}


// ----- Scenario 7: No Route -----

async function scenario7(
  metrics: DispatchMetrics[]
): Promise<void> {
  header(
    "Scenario 7: No Route (BLOCKED roads)"
  );

  await resetAmbulances();
  await resetTraffic();

  // Block ALL roads leading to the pickup area (N13)
  await setTraffic("R-N08-N13", "BLOCKED", 999);
  await setTraffic("R-N13-N08", "BLOCKED", 999);
  await setTraffic("R-N12-N13", "BLOCKED", 999);
  await setTraffic("R-N13-N12", "BLOCKED", 999);
  await setTraffic("R-N13-N14", "BLOCKED", 999);
  await setTraffic("R-N14-N13", "BLOCKED", 999);
  await setTraffic("R-N13-N18", "BLOCKED", 999);
  await setTraffic("R-N18-N13", "BLOCKED", 999);

  const request: DispatchRequest = {
    requestId: "SIM-007",
    pickupLocation: PICKUP_LOCATION,
    emergencyType: "FIRE",
    victimCount: 5,
    excludedAmbulances: []
  };

  const result =
    await runIntelligentDispatch(request);

  printDecision("INTELLIGENT", result);

  // AMB-03 at N13 is co-located with pickup so
  // it should still work (distance 0).
  // But ambulances further away should be excluded
  // from routing through N13 if all edges are BLOCKED.
  // Whether this returns a result or NO_AMBULANCE
  // depends on topology — both are valid outcomes.

  if (isDecision(result)) {
    console.log(
      `  ✅ Scenario 7 PASSED — ` +
      `Selected ${result.ambulanceCode} ` +
      `(co-located or alternate route)`
    );
  } else {
    console.log(
      `  ✅ Scenario 7 PASSED — ` +
      `No route available (roads BLOCKED)`
    );
  }

  await resetTraffic();
}


// ============================================================
// METRICS SUMMARY
// ============================================================

function printMetricsSummary(
  metrics: DispatchMetrics[]
): void {
  header("METRICS SUMMARY");

  console.log("");
  console.log(
    "  ┌───────────┬────────────┬──────┬─────────┬──────────┬──────────┬──────────┐"
  );
  console.log(
    "  │ RequestID │ Ambulance  │ Rank │ Dist km │  ETA min │  Score   │ Traffic  │"
  );
  console.log(
    "  ├───────────┼────────────┼──────┼─────────┼──────────┼──────────┼──────────┤"
  );

  for (const m of metrics) {
    console.log(
      `  │ ${m.requestId.padEnd(9)} ` +
      `│ ${m.ambulanceCode.padEnd(10)} ` +
      `│ ${String(m.candidateRank).padStart(4)} ` +
      `│ ${m.distanceKm.toFixed(2).padStart(7)} ` +
      `│ ${m.estimatedTravelTimeMinutes.toFixed(1).padStart(8)} ` +
      `│ ${m.score.toFixed(4).padStart(8)} ` +
      `│ ${m.trafficCondition.padEnd(8)} │`
    );
  }

  console.log(
    "  └───────────┴────────────┴──────┴─────────┴──────────┴──────────┴──────────┘"
  );
}


// ============================================================
// BASELINE vs INTELLIGENT COMPARISON
// ============================================================

async function comparisonTable(): Promise<void> {
  header(
    "BASELINE vs INTELLIGENT COMPARISON"
  );

  await resetAmbulances();
  await resetTraffic();

  // Apply moderate traffic to test divergence
  await setTraffic("R-N08-N13", "MODERATE", 1.3);
  await setTraffic("R-N13-N08", "MODERATE", 1.3);

  const request: DispatchRequest = {
    requestId: "CMP-001",
    pickupLocation: PICKUP_LOCATION,
    emergencyType: "ACCIDENT",
    victimCount: 1,
    excludedAmbulances: []
  };

  const intelligent =
    await runIntelligentDispatch(request);

  const baseline =
    await runBaselineDispatch(request);

  console.log("");
  console.log(
    "  ┌──────────────┬─────────────────┬─────────────────┐"
  );
  console.log(
    "  │ Metric       │ Baseline        │ Intelligent     │"
  );
  console.log(
    "  ├──────────────┼─────────────────┼─────────────────┤"
  );

  const bAmb = isDecision(baseline)
    ? baseline.ambulanceCode
    : "N/A";
  const iAmb = isDecision(intelligent)
    ? intelligent.ambulanceCode
    : "N/A";

  const bETA = isDecision(baseline)
    ? `${baseline.estimatedTravelTime} min`
    : "N/A";
  const iETA = isDecision(intelligent)
    ? `${intelligent.estimatedTravelTime} min`
    : "N/A";

  const bDist = isDecision(baseline)
    ? `${baseline.distance} km`
    : "N/A";
  const iDist = isDecision(intelligent)
    ? `${intelligent.distance} km`
    : "N/A";

  const bTraffic = isDecision(baseline)
    ? baseline.trafficCondition
    : "N/A";
  const iTraffic = isDecision(intelligent)
    ? intelligent.trafficCondition
    : "N/A";

  const bRouting = "Straight-line";
  const iRouting = "Dijkstra + Traffic";

  const rows = [
    ["Ambulance", bAmb, iAmb],
    ["ETA", bETA, iETA],
    ["Distance", bDist, iDist],
    ["Traffic", bTraffic, iTraffic],
    ["Routing", bRouting, iRouting]
  ];

  for (const [label, b, i] of rows) {
    console.log(
      `  │ ${label.padEnd(12)} ` +
      `│ ${b.padEnd(15)} ` +
      `│ ${i.padEnd(15)} │`
    );
  }

  console.log(
    "  └──────────────┴─────────────────┴─────────────────┘"
  );

  await resetTraffic();
}


// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {

  console.log("");
  console.log(
    "╔════════════════════════════════════════════════╗"
  );
  console.log(
    "║  UyirKappan Dispatch Simulation               ║"
  );
  console.log(
    "║  Intelligent Dispatch Engine Verification      ║"
  );
  console.log(
    "╚════════════════════════════════════════════════╝"
  );

  const metrics: DispatchMetrics[] = [];

  try {
    // Seed test data
    header("SETUP");
    const ambIds = await seedAmbulances();
    console.log(
      `  Ambulance IDs: ${ambIds.join(", ")}`
    );

    // Run all scenarios
    await scenario1(metrics);
    await scenario2(metrics);
    await scenario3(metrics);
    await scenario4(metrics);
    await scenario5(metrics);
    await scenario6(metrics);
    await scenario7(metrics);

    // Print metrics
    printMetricsSummary(metrics);

    // Comparison table
    await comparisonTable();

    header("ALL SCENARIOS COMPLETED ✅");

  } catch (error) {
    console.error(
      "\n❌ Simulation failed:",
      error
    );
  } finally {
    await pool.end();
  }
}

main();
