// ============================================================
// UyirKappan — Dispatch Controller
// Express request handlers for the dispatch API
// ============================================================

import type {
  Request,
  Response
} from "express";

import {
  runIntelligentDispatch,
  runBaselineDispatch
} from "./dispatch.service.js";

import pool from "../../config/database.js";

import type {
  DispatchRequest,
  DispatchConfig
} from "./dispatch.types.js";

import {
  DEFAULT_DISPATCH_CONFIG
} from "./dispatch.types.js";


// ============================================================
// POST /api/dispatch/decide
// ============================================================

export async function dispatchDecide(
  req: Request,
  res: Response
): Promise<void> {

  try {
    const {
      requestId,
      pickupLocation,
      emergencyType,
      victimCount,
      excludedAmbulances
    } = req.body as DispatchRequest;

    // ----- Validate -----
    if (
      !requestId ||
      !pickupLocation?.latitude ||
      !pickupLocation?.longitude
    ) {
      res.status(400).json({
        success: false,
        error:
          "Missing required fields: requestId, pickupLocation.latitude, pickupLocation.longitude"
      });
      return;
    }

    const request: DispatchRequest = {
      requestId,
      pickupLocation,
      emergencyType: emergencyType ?? "GENERAL",
      victimCount: victimCount ?? 1,
      excludedAmbulances: excludedAmbulances ?? []
    };

    const result =
      await runIntelligentDispatch(request);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {

    console.error(
      "[Dispatch] Error in /decide:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Internal dispatch error"
    });
  }
}


// ============================================================
// POST /api/dispatch/decide/baseline
// ============================================================

export async function dispatchDecideBaseline(
  req: Request,
  res: Response
): Promise<void> {

  try {
    const {
      requestId,
      pickupLocation,
      emergencyType,
      victimCount,
      excludedAmbulances
    } = req.body as DispatchRequest;

    if (
      !requestId ||
      !pickupLocation?.latitude ||
      !pickupLocation?.longitude
    ) {
      res.status(400).json({
        success: false,
        error:
          "Missing required fields: requestId, pickupLocation.latitude, pickupLocation.longitude"
      });
      return;
    }

    const request: DispatchRequest = {
      requestId,
      pickupLocation,
      emergencyType: emergencyType ?? "GENERAL",
      victimCount: victimCount ?? 1,
      excludedAmbulances: excludedAmbulances ?? []
    };

    const result =
      await runBaselineDispatch(request);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {

    console.error(
      "[Dispatch] Error in /decide/baseline:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Internal baseline dispatch error"
    });
  }
}


// ============================================================
// GET /api/ambulances?status=AVAILABLE
// ============================================================

export async function getAmbulances(
  req: Request,
  res: Response
): Promise<void> {

  try {
    const status =
      req.query.status as string | undefined;

    let query = `
      SELECT
        ambulance_id,
        ambulance_code,
        ST_Y(current_location::geometry) AS latitude,
        ST_X(current_location::geometry) AS longitude,
        availability_status,
        capabilities
      FROM ambulances
    `;

    const params: string[] = [];

    if (status) {
      query += ` WHERE availability_status = $1`;
      params.push(status);
    }

    query += ` ORDER BY ambulance_code ASC`;

    const result =
      await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ambulanceId: row.ambulance_id,
        ambulanceCode: row.ambulance_code,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        availabilityStatus:
          row.availability_status,
        capabilities: row.capabilities
      }))
    });

  } catch (error) {

    console.error(
      "[Dispatch] Error fetching ambulances:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Failed to fetch ambulances"
    });
  }
}


// ============================================================
// GET /api/ambulances/:id
// ============================================================

export async function getAmbulanceById(
  req: Request,
  res: Response
): Promise<void> {

  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        ambulance_id,
        ambulance_code,
        ST_Y(current_location::geometry) AS latitude,
        ST_X(current_location::geometry) AS longitude,
        availability_status,
        capabilities
      FROM ambulances
      WHERE ambulance_id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: "Ambulance not found"
      });
      return;
    }

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        ambulanceId: row.ambulance_id,
        ambulanceCode: row.ambulance_code,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        availabilityStatus:
          row.availability_status,
        capabilities: row.capabilities
      }
    });

  } catch (error) {

    console.error(
      "[Dispatch] Error fetching ambulance:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Failed to fetch ambulance"
    });
  }
}


// ============================================================
// GET /api/network
// ============================================================

export async function getRoadNetwork(
  req: Request,
  res: Response
): Promise<void> {

  try {
    const nodesResult = await pool.query(`
      SELECT
        node_id,
        node_code,
        node_type,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
      FROM road_nodes
      ORDER BY node_code
    `);

    const segmentsResult = await pool.query(`
      SELECT
        rs.segment_id,
        rs.segment_code,
        n1.node_code AS from_node,
        n2.node_code AS to_node,
        rs.distance_meters,
        rs.base_travel_time_seconds,
        COALESCE(ts.state, 'NORMAL')     AS traffic_state,
        COALESCE(ts.multiplier, 1.0)     AS traffic_multiplier
      FROM road_segments rs
      JOIN road_nodes n1
        ON rs.from_node_id = n1.node_id
      JOIN road_nodes n2
        ON rs.to_node_id   = n2.node_id
      LEFT JOIN traffic_states ts
        ON ts.segment_id   = rs.segment_id
      WHERE rs.is_active = TRUE
      ORDER BY rs.segment_code
    `);

    res.json({
      success: true,
      data: {
        nodes: nodesResult.rows.map(row => ({
          nodeId: row.node_id,
          nodeCode: row.node_code,
          nodeType: row.node_type,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude)
        })),
        segments: segmentsResult.rows.map(row => ({
          segmentId: row.segment_id,
          segmentCode: row.segment_code,
          fromNode: row.from_node,
          toNode: row.to_node,
          distanceMeters: Number(row.distance_meters),
          baseTravelTimeSeconds: Number(
            row.base_travel_time_seconds
          ),
          trafficState: row.traffic_state,
          trafficMultiplier: Number(
            row.traffic_multiplier
          )
        }))
      }
    });

  } catch (error) {

    console.error(
      "[Dispatch] Error fetching network:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Failed to fetch road network"
    });
  }
}


// ============================================================
// GET /api/traffic
// ============================================================

export async function getTrafficConditions(
  req: Request,
  res: Response
): Promise<void> {

  try {
    const result = await pool.query(`
      SELECT
        ts.traffic_id,
        rs.segment_code,
        n1.node_code AS from_node,
        n2.node_code AS to_node,
        ts.state,
        ts.multiplier,
        ts.updated_at,
        ts.expires_at
      FROM traffic_states ts
      JOIN road_segments rs
        ON ts.segment_id = rs.segment_id
      JOIN road_nodes n1
        ON rs.from_node_id = n1.node_id
      JOIN road_nodes n2
        ON rs.to_node_id   = n2.node_id
      ORDER BY rs.segment_code
    `);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        trafficId: row.traffic_id,
        segmentCode: row.segment_code,
        fromNode: row.from_node,
        toNode: row.to_node,
        state: row.state,
        multiplier: Number(row.multiplier),
        updatedAt: row.updated_at,
        expiresAt: row.expires_at
      }))
    });

  } catch (error) {

    console.error(
      "[Dispatch] Error fetching traffic:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Failed to fetch traffic conditions"
    });
  }
}
