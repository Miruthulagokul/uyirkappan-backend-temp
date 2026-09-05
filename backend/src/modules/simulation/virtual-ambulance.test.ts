import {
  createVirtualAmbulance,
  runAmbulanceSimulation
} from "./virtual-ambulance.service.js";

import {
  loadRoadGraph
} from "../routing/graph.service.js";

async function testVirtualAmbulance() {
  console.log(
    "Creating virtual ambulance..."
  );

  const graph = await loadRoadGraph();

  const ambulance =
    await createVirtualAmbulance({
      ambulanceId: "A1",
      requestId: "REQ-SIM-001",

      startLocation: {
        latitude: 13.0800,
        longitude: 80.2700
      },

      destinationLocation: {
        latitude: 13.1000,
        longitude: 80.2900
      }
    });

  const nodeCoordinates =
    new Map(
      [...graph.nodes.values()].map(
        (node) => [
          node.code,
          {
            latitude: node.latitude,
            longitude: node.longitude
          }
        ]
      )
    );

  console.log("\nRoute:");
  console.log(
    ambulance.route.join(" → ")
  );

  console.log(
    "\nStarting continuous simulation...\n"
  );

  const finalState =
    await runAmbulanceSimulation(
      ambulance,
      nodeCoordinates,

      (updatedAmbulance, etaSeconds) => {

  const etaMinutes =
    etaSeconds !== null
      ? (etaSeconds / 60).toFixed(2)
      : "N/A";

  console.log(
    `🚑 ${updatedAmbulance.ambulanceId} | ` +
    `Node=${updatedAmbulance.currentNode} | ` +
    `Index=${updatedAmbulance.routeIndex} | ` +
    `Lat=${updatedAmbulance.latitude.toFixed(6)} | ` +
    `Lng=${updatedAmbulance.longitude.toFixed(6)} | ` +
    `ETA=${etaMinutes} min`
  );
},

      {
        stepsPerSegment: 5,
        intervalMs: 200
      }
    );

  console.log("\nFinal state:");

  console.dir(
    finalState,
    { depth: null }
  );

  console.log(
    "\nVirtual ambulance simulation completed."
  );
}

testVirtualAmbulance()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "\nSimulation failed:",
      error
    );

    process.exit(1);
  });