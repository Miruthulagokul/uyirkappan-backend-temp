export type VirtualAmbulanceStatus =
  | "IDLE"
  | "EN_ROUTE";

export interface VirtualAmbulance {
  ambulanceId: string;
  requestId: string;
  currentNode: string;
  destinationNode: string;
  route: string[];
  routeIndex: number;

  latitude: number;
  longitude: number;

  speedKmh: number;
  heading: number;

  status: VirtualAmbulanceStatus;

  startedAt: Date;
  updatedAt: Date;
}