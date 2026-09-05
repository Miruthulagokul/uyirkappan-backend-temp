export interface LocationUpdate {
  ambulanceId: string;
  requestId: string;

  latitude: number;
  longitude: number;

  speedKmh: number;
  heading: number;

  timestamp: string;
}

export interface TrackingUpdate {
  ambulanceId: string;
  requestId: string;

  latitude: number;
  longitude: number;

  speedKmh: number;
  heading: number;

  distanceMeters: number;
  etaSeconds: number;

  status: string;

  trafficCondition:
    | "NORMAL"
    | "MODERATE"
    | "HEAVY"
    | "BLOCKED";

  timestamp: string;
}