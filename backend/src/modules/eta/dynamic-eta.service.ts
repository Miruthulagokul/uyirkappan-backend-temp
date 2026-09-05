import { loadRoadGraph } from "../routing/graph.service.js";
import { dijkstra } from "../routing/dijkstra.service.js";

export interface DynamicEtaResult {
  currentNode: string;
  destinationNode: string;
  distanceMeters: number;
  travelTimeSeconds: number;
  etaSeconds: number;
}

export async function calculateDynamicEta(
  currentNodeCode: string,
  destinationNodeCode: string
): Promise<DynamicEtaResult | null> {

  // Load the latest road graph.
  // This ensures the latest traffic state is considered.
  const graph = await loadRoadGraph();

  const currentNode = [...graph.nodes.values()].find(
    node => node.code === currentNodeCode
  );

  const destinationNode = [...graph.nodes.values()].find(
    node => node.code === destinationNodeCode
  );

  if (!currentNode) {
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
    currentNode.id,
    destinationNode.id
  );

  if (!result) {
    return null;
  }

  return {
    currentNode: currentNodeCode,
    destinationNode: destinationNodeCode,
    distanceMeters: result.distanceMeters,
    travelTimeSeconds: result.travelTimeSeconds,
    etaSeconds: result.travelTimeSeconds
  };
}