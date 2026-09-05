import { calculateRealRoute } from "./osrm.service.js";

async function testRealRoute() {

  console.log("====================================");
  console.log("REAL MAP ROUTING TEST");
  console.log("====================================");

  // Chennai starting point
  const start = {
    latitude: 13.0827,
    longitude: 80.2707
  };

  // Chennai destination
  const destination = {
    latitude: 13.1000,
    longitude: 80.2900
  };

  const route = await calculateRealRoute(
    start,
    destination
  );

  console.log("\nREAL ROAD ROUTE");

  console.log(
    `Distance: ${route.distanceMeters.toFixed(2)} meters`
  );

  console.log(
    `Distance: ${(route.distanceMeters / 1000).toFixed(2)} km`
  );

  console.log(
    `Duration: ${route.durationSeconds.toFixed(2)} seconds`
  );

  console.log(
    `Duration: ${(route.durationSeconds / 60).toFixed(2)} minutes`
  );

  console.log(
    `Road coordinates: ${route.geometry.coordinates.length}`
  );

  console.log("\nFirst 5 road coordinates:");

  console.dir(
    route.geometry.coordinates.slice(0, 5),
    { depth: null }
  );

  console.log("\nLast 5 road coordinates:");

  console.dir(
    route.geometry.coordinates.slice(-5),
    { depth: null }
  );

  console.log("\n====================================");
  console.log("REAL MAP ROUTING TEST COMPLETED");
  console.log("====================================");
}

testRealRoute()
  .then(() => process.exit(0))
  .catch(error => {

    console.error(
      "\nReal route test failed:"
    );

    console.error(error);

    process.exit(1);
  });