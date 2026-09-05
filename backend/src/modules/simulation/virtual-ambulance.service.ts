import {
  calculateRoute
} from "../routing/routing.service.js";

import {
  calculateDynamicEta
} from "../eta/dynamic-eta.service.js";

import type {
  VirtualAmbulance
} from "./virtual-ambulance.types.js";

export interface StartSimulationInput {
  ambulanceId: string;
  requestId: string;

  startLocation: {
    latitude: number;
    longitude: number;
  };

  destinationLocation: {
    latitude: number;
    longitude: number;
  };
}

export async function createVirtualAmbulance(
  input: StartSimulationInput
): Promise<VirtualAmbulance> {

  const route = await calculateRoute(
    input.startLocation,
    input.destinationLocation
  );

  if (!route) {
    throw new Error(
      "No route available for ambulance"
    );
  }

  return {
    ambulanceId: input.ambulanceId,
    requestId: input.requestId,

    currentNode: route.startNode,

    destinationNode:
      route.destinationNode,

    route: route.path,

    routeIndex: 0,

    latitude:
      input.startLocation.latitude,

    longitude:
      input.startLocation.longitude,

    speedKmh: 40,

    heading: 0,

    status: "EN_ROUTE",

    startedAt: new Date(),

    updatedAt: new Date()
  };
}


/**
 * Move the ambulance a fraction of the way
 * from the current node to the next node.
 */
export function moveAmbulance(
  ambulance: VirtualAmbulance,

  nodeCoordinates: Map<
    string,
    {
      latitude: number;
      longitude: number;
    }
  >,

  progress: number
): VirtualAmbulance {

  if (
    ambulance.routeIndex >=
    ambulance.route.length - 1
  ) {
    return {
      ...ambulance,

      status: "IDLE",

      updatedAt: new Date()
    };
  }

  const currentNodeId =
    ambulance.route[
      ambulance.routeIndex
    ];

  const nextNodeId =
    ambulance.route[
      ambulance.routeIndex + 1
    ];

  const current =
    nodeCoordinates.get(currentNodeId);

  const next =
    nodeCoordinates.get(nextNodeId);

  if (!current || !next) {
    throw new Error(
      "Route node coordinates not found"
    );
  }

  const clampedProgress =
    Math.max(
      0,
      Math.min(1, progress)
    );

  const latitude =
    current.latitude +
    (next.latitude -
      current.latitude) *
      clampedProgress;

  const longitude =
    current.longitude +
    (next.longitude -
      current.longitude) *
      clampedProgress;

  const completedSegment =
    clampedProgress >= 1;

  return {
    ...ambulance,

    latitude,

    longitude,

    currentNode:
      completedSegment
        ? nextNodeId
        : currentNodeId,

    routeIndex:
      completedSegment
        ? ambulance.routeIndex + 1
        : ambulance.routeIndex,

    status: "EN_ROUTE",

    updatedAt: new Date()
  };
}


/**
 * Run continuous ambulance simulation
 * with dynamic ETA calculation.
 */
export async function runAmbulanceSimulation(
  ambulance: VirtualAmbulance,

  nodeCoordinates: Map<
    string,
    {
      latitude: number;
      longitude: number;
    }
  >,

  onUpdate: (
    ambulance: VirtualAmbulance,
    etaSeconds: number | null
  ) => void,

  options?: {
    stepsPerSegment?: number;
    intervalMs?: number;
  }

): Promise<VirtualAmbulance> {

  const stepsPerSegment =
    options?.stepsPerSegment ?? 10;

  const intervalMs =
    options?.intervalMs ?? 300;

  let current =
    ambulance;

  for (
    let segment = 0;
    segment <
    current.route.length - 1;
    segment++
  ) {

    for (
      let step = 1;
      step <= stepsPerSegment;
      step++
    ) {

      const progress =
        step / stepsPerSegment;

      current =
        moveAmbulance(
          {
            ...current,

            routeIndex: segment
          },

          nodeCoordinates,

          progress
        );


      /*
       * Calculate ETA from the ambulance's
       * current node to destination.
       */
      const eta =
        await calculateDynamicEta(
          current.currentNode,
          current.destinationNode
        );


      const etaSeconds =
        eta?.etaSeconds ?? null;


      /*
       * Send ambulance + ETA to caller.
       */
      onUpdate(
        current,
        etaSeconds
      );


      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            intervalMs
          )
      );
    }
  }


  return {
    ...current,

    status: "IDLE",

    updatedAt: new Date()
  };
}