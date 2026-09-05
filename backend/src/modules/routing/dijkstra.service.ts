import type {
  RoadGraph,
  GraphEdge
} from "./graph.types.js";

export interface DijkstraResult {
  path: string[];
  pathNodeCodes: string[];
  distanceMeters: number;
  travelTimeSeconds: number;
}

interface QueueItem {
  nodeId: string;
  travelTimeSeconds: number;
}

export function dijkstra(
  graph: RoadGraph,
  startNodeId: string,
  destinationNodeId: string
): DijkstraResult | null {
  if (!graph.nodes.has(startNodeId)) {
    throw new Error(
      `Start node not found: ${startNodeId}`
    );
  }

  if (!graph.nodes.has(destinationNodeId)) {
    throw new Error(
      `Destination node not found: ${destinationNodeId}`
    );
  }

  if (startNodeId === destinationNodeId) {
    return {
  path: [startNodeId],
  pathNodeCodes: [
    graph.nodes.get(startNodeId)!.code
  ],
  distanceMeters: 0,
  travelTimeSeconds: 0
};
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, GraphEdge | null>();

  for (const nodeId of graph.nodes.keys()) {
    distances.set(nodeId, Infinity);
    previous.set(nodeId, null);
  }

  distances.set(startNodeId, 0);

  const queue: QueueItem[] = [
    {
      nodeId: startNodeId,
      travelTimeSeconds: 0
    }
  ];

  while (queue.length > 0) {
    queue.sort(
      (a, b) =>
        a.travelTimeSeconds -
        b.travelTimeSeconds
    );

    const current = queue.shift()!;

    const knownDistance =
      distances.get(current.nodeId) ?? Infinity;

    if (
      current.travelTimeSeconds >
      knownDistance
    ) {
      continue;
    }

    if (
      current.nodeId ===
      destinationNodeId
    ) {
      break;
    }

    const edges =
      graph.adjacencyList.get(
        current.nodeId
      ) ?? [];

    for (const edge of edges) {
      // BLOCKED roads cannot be used.
      if (edge.trafficState === "BLOCKED") {
        continue;
      }

      const effectiveTravelTime =
        edge.travelTimeSeconds *
        edge.trafficMultiplier;

      const newTravelTime =
        current.travelTimeSeconds +
        effectiveTravelTime;

      const existingTravelTime =
        distances.get(edge.to) ??
        Infinity;

      if (
        newTravelTime <
        existingTravelTime
      ) {
        distances.set(
          edge.to,
          newTravelTime
        );

        previous.set(
          edge.to,
          edge
        );

        queue.push({
          nodeId: edge.to,
          travelTimeSeconds:
            newTravelTime
        });
      }
    }
  }

  const finalTravelTime =
    distances.get(destinationNodeId);

  if (
    finalTravelTime === undefined ||
    finalTravelTime === Infinity
  ) {
    return null;
  }

  const path: string[] = [];

  let currentNodeId =
    destinationNodeId;

  while (
    currentNodeId !== startNodeId
  ) {
    path.unshift(currentNodeId);

    const previousEdge =
      previous.get(
        currentNodeId
      );

    if (!previousEdge) {
      return null;
    }

    currentNodeId =
      previousEdge.from;
  }

  path.unshift(startNodeId);

  let distanceMeters = 0;

  for (
    let i = 0;
    i < path.length - 1;
    i++
  ) {
    const fromNode = path[i];
    const toNode = path[i + 1];

    const edges =
      graph.adjacencyList.get(
        fromNode
      ) ?? [];

    const edge = edges.find(
      candidate =>
        candidate.to === toNode
    );

    if (edge) {
      distanceMeters +=
        edge.distanceMeters;
    }
  }

  return {
  path,
  pathNodeCodes: path.map(
    nodeId => graph.nodes.get(nodeId)!.code
  ),
  distanceMeters,
  travelTimeSeconds: Math.round(finalTravelTime)
};
}