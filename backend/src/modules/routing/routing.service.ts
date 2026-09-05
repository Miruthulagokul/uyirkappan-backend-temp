import pool from "../../config/database.js";
import { loadRoadGraph } from "./graph.service.js";
import { dijkstra } from "./dijkstra.service.js";
import type { RoadGraph } from "./graph.types.js";

export interface Location {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  startNode: string;
  destinationNode: string;
  path: string[];
  distanceMeters: number;
  travelTimeSeconds: number;
}

let cachedGraph: RoadGraph | null = null;

async function getGraph(): Promise<RoadGraph> {
  if (!cachedGraph) {
    cachedGraph = await loadRoadGraph();
  }

  return cachedGraph;
}

/**
 * Find the nearest road node to a GPS location.
 */
async function findNearestNode(
  location: Location
): Promise<string> {
  const result = await pool.query(
    `
    SELECT
      node_id,
      node_code,
      ST_Distance(
        road_nodes.location,
        ST_SetSRID(
          ST_MakePoint($1, $2),
          4326
        )::geography
      ) AS distance_meters
    FROM road_nodes
    ORDER BY road_nodes.location <-> ST_SetSRID(
      ST_MakePoint($1, $2),
      4326
    )::geography
    LIMIT 1
    `,
    [
      location.longitude,
      location.latitude
    ]
  );

  if (result.rows.length === 0) {
    throw new Error(
      "No road node found near location"
    );
  }

  return result.rows[0].node_id;
}

/**
 * Calculate the fastest traffic-aware route
 * between two GPS locations.
 */
export async function calculateRoute(
  startLocation: Location,
  destinationLocation: Location
): Promise<RouteResult | null> {
  const graph = await getGraph();

  const startNodeId =
    await findNearestNode(startLocation);

  const destinationNodeId =
    await findNearestNode(destinationLocation);

  const result = dijkstra(
    graph,
    startNodeId,
    destinationNodeId
  );

  if (!result) {
    return null;
  }

  return {
    startNode:
      graph.nodes.get(startNodeId)!.code,

    destinationNode:
      graph.nodes.get(destinationNodeId)!.code,

    path: result.pathNodeCodes,

    distanceMeters:
      result.distanceMeters,

    travelTimeSeconds:
      result.travelTimeSeconds
  };
}