import pool from "../../config/database.js";

import { loadRoadGraph } from "../routing/graph.service.js";
import { dijkstra } from "../routing/dijkstra.service.js";

export interface EtaResult {
  distanceMeters: number;
  travelTimeSeconds: number;
  etaSeconds: number;
}

/**
 * Calculate ETA from a road node to the destination node.
 *
 * Uses the current traffic-aware road graph.
 */
export async function calculateEta(
  currentNodeCode: string,
  destinationNodeCode: string
): Promise<EtaResult | null> {
  const { loadRoadGraph } =
    await import("../routing/graph.service.js");

  const { dijkstra } =
    await import("../routing/dijkstra.service.js");

  const graph =
    await loadRoadGraph();

  const startNode = [
    ...graph.nodes.values()
  ].find(
    node =>
      node.code === currentNodeCode
  );

  const destinationNode = [
    ...graph.nodes.values()
  ].find(
    node =>
      node.code === destinationNodeCode
  );

  if (!startNode) {
    throw new Error(
      `Current node not found: ${currentNodeCode}`
    );
  }

  if (!destinationNode) {
    throw new Error(
      `Destination node not found: ${destinationNodeCode}`
    );
  }

  const result = dijkstra(
    graph,
    startNode.id,
    destinationNode.id
  );

  if (!result) {
    return null;
  }

  return {
    distanceMeters:
      result.distanceMeters,

    travelTimeSeconds:
      result.travelTimeSeconds,

    etaSeconds:
      result.travelTimeSeconds
  };
}