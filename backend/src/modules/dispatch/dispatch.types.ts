// ============================================================
// UyirKappan — Intelligent Dispatch Engine
// Shared types for dispatch, scoring, candidates, and metrics
// ============================================================

import type { TrafficState } from "../routing/graph.types.js";


// ----- Dispatch Request -----

export interface DispatchRequest {
  requestId: string;

  pickupLocation: {
    latitude: number;
    longitude: number;
  };

  emergencyType: string;

  victimCount: number;

  excludedAmbulances: string[];
}


// ----- Candidate Ambulance -----

export type AmbulanceStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "BUSY"
  | "OFFLINE"
  | "MAINTENANCE";

export interface CandidateAmbulance {
  ambulanceId: string;
  ambulanceCode: string;

  latitude: number;
  longitude: number;

  availabilityStatus: AmbulanceStatus;

  capabilities: Record<string, unknown>;

  /** Straight-line distance to pickup in metres. */
  straightLineDistanceMeters: number;
}


// ----- Scored Candidate -----

export interface ScoredCandidate {
  ambulanceId: string;
  ambulanceCode: string;

  /** Route distance in kilometres. */
  distanceKm: number;

  /** Estimated travel time in minutes (traffic-adjusted). */
  estimatedTravelTimeMinutes: number;

  /** Base travel time in minutes (no traffic). */
  baseTravelTimeMinutes: number;

  /** Weighted score — lower is better. */
  score: number;

  /** Road-network path (node codes). */
  route: string[];

  /** Dominant traffic condition on the route. */
  trafficCondition: TrafficState;

  /** Human-readable explanation of why this candidate was ranked. */
  explanation: string;
}


// ----- Dispatch Decision -----

export interface DispatchDecision {
  requestId: string;
  ambulanceId: string;
  ambulanceCode: string;

  estimatedTravelTime: number;   // minutes
  distance: number;              // km
  score: number;

  route: string[];
  trafficCondition: TrafficState;
  explanation: string;

  /** All evaluated candidates, sorted best-to-worst. */
  candidates: ScoredCandidate[];
}

export interface NoAmbulanceDecision {
  requestId: string;
  status: "NO_AMBULANCE_AVAILABLE";
  reason: string;
}

export type DispatchResult = DispatchDecision | NoAmbulanceDecision;


// ----- Attempt Tracking -----

export type AttemptResponse =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "TIMEOUT";

export interface DispatchAttempt {
  attemptNumber: number;
  ambulanceId: string;
  ambulanceCode: string;
  assignedAt: Date;
  response: AttemptResponse;
  failureReason?: string;
}


// ----- Dispatch Metrics -----

export interface DispatchMetrics {
  requestId: string;
  ambulanceId: string;
  ambulanceCode: string;
  candidateRank: number;
  distanceKm: number;
  estimatedTravelTimeMinutes: number;
  trafficCondition: TrafficState;
  score: number;
  assignedAt: Date;
  responseAt?: Date;
  response: AttemptResponse;
}


// ----- Scoring Weights -----

export interface ScoringWeights {
  travelTime: number;   // default 0.50
  distance: number;     // default 0.20
  traffic: number;      // default 0.20
  availability: number; // default 0.10
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  travelTime: 0.50,
  distance: 0.20,
  traffic: 0.20,
  availability: 0.10
};


// ----- Traffic Multipliers -----

export const TRAFFIC_MULTIPLIERS: Record<TrafficState, number> = {
  NORMAL: 1.0,
  MODERATE: 1.3,
  HEAVY: 1.8,
  BLOCKED: Infinity
};


// ----- Search Configuration -----

export interface DispatchConfig {
  /** Search radius in metres (default 10 000 m = 10 km). */
  searchRadiusMeters: number;

  /** Scoring weights. */
  weights: ScoringWeights;
}

export const DEFAULT_DISPATCH_CONFIG: DispatchConfig = {
  searchRadiusMeters: 10_000,
  weights: DEFAULT_SCORING_WEIGHTS
};
