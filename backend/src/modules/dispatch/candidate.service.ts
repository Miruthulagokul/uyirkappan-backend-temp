// ============================================================
// UyirKappan — Candidate Discovery Service
// Discovers and filters available ambulance candidates
// ============================================================

import pool from "../../config/database.js";

import type {
  CandidateAmbulance,
  DispatchConfig,
  DEFAULT_DISPATCH_CONFIG
} from "./dispatch.types.js";


/**
 * Find all ambulance candidates that are:
 *   1. AVAILABLE (not BUSY, OFFLINE, ASSIGNED, MAINTENANCE)
 *   2. Within the configured search radius of the pickup location
 *   3. NOT in the excluded-ambulances list (for fallback re-dispatch)
 *
 * Returns candidates sorted by straight-line distance (nearest first).
 */
export async function findAvailableCandidates(
  pickupLocation: { latitude: number; longitude: number },
  excludedAmbulances: string[],
  config: {
    searchRadiusMeters: number;
  }
): Promise<CandidateAmbulance[]> {

  // Build the exclusion clause dynamically.
  // If the list is empty we skip the filter entirely.
  const hasExclusions =
    excludedAmbulances.length > 0;

  const query = `
    SELECT
      ambulance_id,
      ambulance_code,
      ST_Y(current_location::geometry)  AS latitude,
      ST_X(current_location::geometry)  AS longitude,
      availability_status,
      capabilities,

      ST_Distance(
        current_location,
        ST_SetSRID(
          ST_MakePoint($1, $2),
          4326
        )::geography
      ) AS straight_line_distance_meters

    FROM ambulances

    WHERE availability_status = 'AVAILABLE'

      AND ST_DWithin(
        current_location,
        ST_SetSRID(
          ST_MakePoint($1, $2),
          4326
        )::geography,
        $3
      )

      ${
        hasExclusions
          ? `AND ambulance_id NOT IN (${
              excludedAmbulances
                .map((_, i) => `$${i + 4}`)
                .join(", ")
            })`
          : ""
      }

    ORDER BY straight_line_distance_meters ASC
  `;

  const params: (string | number)[] = [
    pickupLocation.longitude,
    pickupLocation.latitude,
    config.searchRadiusMeters,
    ...excludedAmbulances
  ];

  const result = await pool.query(query, params);

  return result.rows.map((row): CandidateAmbulance => ({
    ambulanceId: row.ambulance_id,
    ambulanceCode: row.ambulance_code,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    availabilityStatus: row.availability_status,
    capabilities: row.capabilities ?? {},
    straightLineDistanceMeters: Number(
      row.straight_line_distance_meters
    )
  }));
}
