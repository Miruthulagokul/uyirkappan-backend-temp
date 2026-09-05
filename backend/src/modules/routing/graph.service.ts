import pool from "../../config/database.js";

import type {
  GraphNode,
  GraphEdge,
  RoadGraph,
  TrafficState
} from "./graph.types.js";

export async function loadRoadGraph(): Promise<RoadGraph> {
  const graph: RoadGraph = {
    nodes: new Map(),
    adjacencyList: new Map()
  };

  const nodesResult = await pool.query(`
    SELECT
      node_id,
      node_code,
      ST_Y(location::geometry) AS latitude,
      ST_X(location::geometry) AS longitude
    FROM road_nodes
  `);

  for (const row of nodesResult.rows) {
    const node: GraphNode = {
      id: row.node_id,
      code: row.node_code,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude)
    };

    graph.nodes.set(node.id, node);
    graph.adjacencyList.set(node.id, []);
  }

  const segmentsResult = await pool.query(`
    SELECT
      rs.segment_id,
      rs.from_node_id,
      rs.to_node_id,
      rs.distance_meters,
      rs.base_travel_time_seconds,

      COALESCE(ts.state, 'NORMAL') AS traffic_state,
      COALESCE(ts.multiplier, 1.0) AS traffic_multiplier

    FROM road_segments rs

    LEFT JOIN traffic_states ts
      ON ts.segment_id = rs.segment_id

    WHERE rs.is_active = TRUE
  `);

  for (const row of segmentsResult.rows) {
    const edge: GraphEdge = {
      segmentId: row.segment_id,
      from: row.from_node_id,
      to: row.to_node_id,
      distanceMeters: Number(row.distance_meters),
      travelTimeSeconds: Number(row.base_travel_time_seconds),
      trafficState: row.traffic_state as TrafficState,
      trafficMultiplier: Number(row.traffic_multiplier)
    };

    graph.adjacencyList
      .get(edge.from)
      ?.push(edge);
  }

  return graph;
}