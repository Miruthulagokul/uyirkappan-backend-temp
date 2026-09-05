export interface RealRouteResult {
  distanceMeters: number;
  durationSeconds: number;

  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

export async function calculateRealRoute(
  start: {
    latitude: number;
    longitude: number;
  },
  destination: {
    latitude: number;
    longitude: number;
  }
): Promise<RealRouteResult> {

  const startCoordinate =
    `${start.longitude},${start.latitude}`;

  const destinationCoordinate =
    `${destination.longitude},${destination.latitude}`;

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${startCoordinate};${destinationCoordinate}` +
    `?overview=full&geometries=geojson&steps=true`;

  console.log("\nRequesting real road route...");
  console.log(url);

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `OSRM request failed: ${response.status}`
    );
  }

  const data = await response.json();

  if (data.code !== "Ok") {
    throw new Error(
      `OSRM routing failed: ${data.code}`
    );
  }

  const route = data.routes[0];

  return {
    distanceMeters: route.distance,

    durationSeconds: route.duration,

    geometry: route.geometry
  };
}