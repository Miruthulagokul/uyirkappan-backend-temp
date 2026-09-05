export type TrafficState =
  | "NORMAL"
  | "MODERATE"
  | "HEAVY"
  | "BLOCKED";

export interface GraphNode {
  id: string;
  code: string;
  latitude: number;
  longitude: number;
}

export interface GraphEdge {
  segmentId: string;
  from: string;
  to: string;
  distanceMeters: number;
  travelTimeSeconds: number;
  trafficState: TrafficState;
  trafficMultiplier: number;
}

export interface RoadGraph {
  nodes: Map<string, GraphNode>;
  adjacencyList: Map<string, GraphEdge[]>;
}