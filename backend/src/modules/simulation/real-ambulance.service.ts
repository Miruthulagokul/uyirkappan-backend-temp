import {
  calculateRealRoute
} from "../routing/osrm.service.js";


export type RealAmbulanceStatus =
  | "EN_ROUTE"
  | "ARRIVED";


export type TrafficCondition =
  | "NORMAL"
  | "MODERATE"
  | "HEAVY"
  | "BLOCKED";


export interface RealAmbulance {

  ambulanceId: string;

  requestId: string;


  latitude: number;

  longitude: number;


  destinationLatitude: number;

  destinationLongitude: number;


  routeCoordinates:
    [number, number][];


  /*
   * Cumulative distance from the
   * beginning of the route.
   */
  cumulativeDistances:
    number[];


  routeIndex: number;


  distanceMeters: number;

  totalDistanceMeters: number;


  /*
   * Original route ETA from OSRM.
   * This value never changes.
   */
  baselineEtaSeconds: number;


  /*
   * Current dynamic ETA.
   */
  etaSeconds: number;


  /*
   * Average route speed.
   */
  speedKmh: number;


  /*
   * Direction of travel.
   */
  heading: number;


  trafficCondition:
    TrafficCondition;


  trafficMultiplier: number;


  status:
    RealAmbulanceStatus;
}


export interface CreateRealAmbulanceInput {

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


/* =====================================================
   HAVERSINE DISTANCE
   ===================================================== */

function calculateDistanceMeters(

  coordinateA:
    [number, number],

  coordinateB:
    [number, number]

): number {

  const [
    longitude1,
    latitude1
  ] = coordinateA;


  const [
    longitude2,
    latitude2
  ] = coordinateB;


  const earthRadius =
    6371000;


  const lat1 =
    latitude1 *
    Math.PI /
    180;


  const lat2 =
    latitude2 *
    Math.PI /
    180;


  const deltaLat =
    (latitude2 - latitude1) *
    Math.PI /
    180;


  const deltaLon =
    (longitude2 - longitude1) *
    Math.PI /
    180;


  const a =

    Math.sin(deltaLat / 2) *
    Math.sin(deltaLat / 2)

    +

    Math.cos(lat1) *
    Math.cos(lat2) *

    Math.sin(deltaLon / 2) *
    Math.sin(deltaLon / 2);


  const c =

    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  return earthRadius * c;
}


/* =====================================================
   CUMULATIVE ROUTE DISTANCE
   ===================================================== */

function calculateCumulativeDistances(

  coordinates:
    [number, number][]

): number[] {

  const cumulative: number[] = [0];


  let totalDistance = 0;


  for (
    let index = 1;
    index < coordinates.length;
    index++
  ) {

    const segmentDistance =
      calculateDistanceMeters(

        coordinates[index - 1],

        coordinates[index]

      );


    totalDistance +=
      segmentDistance;


    cumulative.push(
      totalDistance
    );

  }


  return cumulative;
}


/* =====================================================
   BEARING / HEADING
   ===================================================== */

function calculateHeading(

  previous:
    [number, number],

  current:
    [number, number]

): number {

  const [
    previousLongitude,
    previousLatitude
  ] = previous;


  const [
    currentLongitude,
    currentLatitude
  ] = current;


  const latitude1 =
    previousLatitude *
    Math.PI /
    180;


  const latitude2 =
    currentLatitude *
    Math.PI /
    180;


  const longitudeDifference =
    (
      currentLongitude -
      previousLongitude
    ) *
    Math.PI /
    180;


  const y =
    Math.sin(
      longitudeDifference
    ) *
    Math.cos(latitude2);


  const x =

    Math.cos(latitude1) *
    Math.sin(latitude2)

    -

    Math.sin(latitude1) *
    Math.cos(latitude2) *
    Math.cos(
      longitudeDifference
    );


  const bearing =
    Math.atan2(y, x) *
    180 /
    Math.PI;


  return (
    bearing + 360
  ) % 360;
}


/* =====================================================
   CREATE REAL AMBULANCE
   ===================================================== */

export async function createRealAmbulance(

  input:
    CreateRealAmbulanceInput

): Promise<RealAmbulance> {


  const route =
    await calculateRealRoute(

      input.startLocation,

      input.destinationLocation

    );


  const coordinates =
    route.geometry.coordinates;


  if (
    coordinates.length === 0
  ) {

    throw new Error(
      "Real road route contains no coordinates"
    );

  }


  /*
   * Calculate cumulative GPS distances.
   */

  const cumulativeDistances =
    calculateCumulativeDistances(
      coordinates
    );


  /*
   * OSRM distance is the authoritative
   * road distance.
   *
   * Scale our GPS cumulative distances
   * to match OSRM's road distance.
   */

  const calculatedTotalDistance =
    cumulativeDistances[
      cumulativeDistances.length - 1
    ];


  const scaleFactor =

    calculatedTotalDistance > 0

      ? route.distanceMeters /
        calculatedTotalDistance

      : 1;


  const scaledCumulativeDistances =
    cumulativeDistances.map(

      distance =>
        distance *
        scaleFactor

    );


  /*
   * Average speed based on OSRM
   * distance and duration.
   */

  const averageSpeedMetersPerSecond =

    route.distanceMeters /
    Math.max(
      route.durationSeconds,
      1
    );


  const averageSpeedKmh =

    averageSpeedMetersPerSecond *
    3.6;


  return {

    ambulanceId:
      input.ambulanceId,

    requestId:
      input.requestId,


    latitude:
      input.startLocation.latitude,

    longitude:
      input.startLocation.longitude,


    destinationLatitude:
      input.destinationLocation.latitude,

    destinationLongitude:
      input.destinationLocation.longitude,


    routeCoordinates:
      coordinates,


    cumulativeDistances:
      scaledCumulativeDistances,


    routeIndex:
      0,


    distanceMeters:
      route.distanceMeters,

    totalDistanceMeters:
      route.distanceMeters,


    baselineEtaSeconds:
      route.durationSeconds,

    etaSeconds:
      route.durationSeconds,


    speedKmh:
      Number(
        averageSpeedKmh.toFixed(2)
      ),


    heading:
      0,


    trafficCondition:
      "NORMAL",


    trafficMultiplier:
      1.0,


    status:
      "EN_ROUTE"

  };

}


/* =====================================================
   MOVE REAL AMBULANCE
   ===================================================== */

export function moveRealAmbulance(

  ambulance:
    RealAmbulance

): RealAmbulance {


  const nextIndex =
    ambulance.routeIndex + 1;


  /*
   * ARRIVAL
   */

  if (

    nextIndex >=
    ambulance.routeCoordinates.length

  ) {

    return {

      ...ambulance,


      latitude:
        ambulance.destinationLatitude,

      longitude:
        ambulance.destinationLongitude,


      routeIndex:
        ambulance.routeCoordinates.length - 1,


      distanceMeters:
        0,


      etaSeconds:
        0,


      speedKmh:
        0,


      heading:
        ambulance.heading,


      status:
        "ARRIVED"

    };

  }


  const [
    longitude,
    latitude
  ] =
    ambulance.routeCoordinates[
      nextIndex
    ];


  /*
   * Previous coordinate.
   */

  const previousCoordinate =

    ambulance.routeCoordinates[
      ambulance.routeIndex
    ];


  /*
   * Calculate heading.
   */

  const heading =
    calculateHeading(

      previousCoordinate,

      [
        longitude,
        latitude
      ]

    );


  /*
   * Actual travelled distance.
   */

  const travelledDistance =

    ambulance
      .cumulativeDistances[
        nextIndex
      ];


  /*
   * Actual remaining road distance.
   */

  const remainingDistance =

    Math.max(

      0,

      ambulance.totalDistanceMeters -
      travelledDistance

    );


  /*
   * Remaining baseline ETA.
   *
   * IMPORTANT:
   *
   * We calculate from the ORIGINAL
   * route ETA, not the previous dynamic ETA.
   */

  const remainingFraction =

    ambulance.totalDistanceMeters > 0

      ? remainingDistance /
        ambulance.totalDistanceMeters

      : 0;


  const baselineRemainingEta =

    ambulance.baselineEtaSeconds *
    remainingFraction;


  /*
   * Apply current traffic multiplier.
   */

  const dynamicEta =

    baselineRemainingEta *
    ambulance.trafficMultiplier;


  return {

    ...ambulance,


    latitude,

    longitude,


    routeIndex:
      nextIndex,


    distanceMeters:
      remainingDistance,


    etaSeconds:
      Math.max(
        0,
        dynamicEta
      ),


    speedKmh:

      ambulance.trafficMultiplier > 0

        ? ambulance.speedKmh /
          ambulance.trafficMultiplier

        : ambulance.speedKmh,


    heading,


    status:
      "EN_ROUTE"

  };

}


/* =====================================================
   UPDATE TRAFFIC
   ===================================================== */

export function updateAmbulanceTraffic(

  ambulance:
    RealAmbulance,

  trafficCondition:
    TrafficCondition

): RealAmbulance {


  const multipliers: Record<
    TrafficCondition,
    number
  > = {

    NORMAL: 1.0,

    MODERATE: 1.5,

    HEAVY: 2.5,

    BLOCKED: 999.0

  };


  const multiplier =
    multipliers[
      trafficCondition
    ];


  /*
   * Calculate current remaining
   * baseline ETA.
   */

  const remainingFraction =

    ambulance.totalDistanceMeters > 0

      ? ambulance.distanceMeters /
        ambulance.totalDistanceMeters

      : 0;


  const baselineRemainingEta =

    ambulance.baselineEtaSeconds *
    remainingFraction;


  const dynamicEta =

    baselineRemainingEta *
    multiplier;


  return {

    ...ambulance,


    trafficCondition,


    trafficMultiplier:
      multiplier,


    etaSeconds:

      trafficCondition === "BLOCKED"

        ? Number.POSITIVE_INFINITY

        : Math.max(
            0,
            dynamicEta
          )

  };

}


/* =====================================================
   RUN SIMULATION
   ===================================================== */

export async function runRealAmbulanceSimulation(

  ambulance:
    RealAmbulance,

  onUpdate:
    (
      ambulance:
        RealAmbulance
    ) => void,

  options?: {

    intervalMs?: number;

    maxUpdates?: number;

  }

): Promise<RealAmbulance> {


  const intervalMs =
    options?.intervalMs ?? 200;


  const maxUpdates =

    options?.maxUpdates ??

    ambulance
      .routeCoordinates
      .length;


  let current =
    ambulance;


  let updates = 0;


  /*
   * Send initial state.
   */

  onUpdate(
    current
  );


  while (

    current.status !==
      "ARRIVED"

    &&

    updates <
      maxUpdates

  ) {


    current =
      moveRealAmbulance(
        current
      );


    onUpdate(
      current
    );


    updates++;


    if (
      current.status ===
      "ARRIVED"
    ) {

      break;

    }


    await new Promise(

      resolve =>
        setTimeout(
          resolve,
          intervalMs
        )

    );

  }


  return current;

}