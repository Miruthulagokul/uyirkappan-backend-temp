import {
  createRealAmbulance,
  runRealAmbulanceSimulation
} from "./real-ambulance.service.js";

async function testRealAmbulance() {

  console.log(
    "===================================="
  );

  console.log(
    "REAL ROAD AMBULANCE SIMULATION"
  );

  console.log(
    "===================================="
  );


  const ambulance =
    await createRealAmbulance({

      ambulanceId: "A1",

      requestId: "REAL-SIM-001",

      startLocation: {
        latitude: 13.0827,
        longitude: 80.2707
      },

      destinationLocation: {
        latitude: 13.1000,
        longitude: 80.2900
      }

    });


  console.log("\n🚑 Ambulance created");

  console.log(
    `Route points: ${
      ambulance.routeCoordinates.length
    }`
  );

  console.log(
    `Distance: ${
      (ambulance.distanceMeters / 1000)
        .toFixed(2)
    } km`
  );

  console.log(
    `Initial ETA: ${
      (ambulance.etaSeconds / 60)
        .toFixed(2)
    } minutes`
  );


  console.log(
    "\nStarting REAL ROAD simulation...\n"
  );


  const finalState =
    await runRealAmbulanceSimulation(

      ambulance,

      updated => {

        console.log(
          `🚑 ${updated.ambulanceId} | ` +
          `Lat=${updated.latitude.toFixed(6)} | ` +
          `Lng=${updated.longitude.toFixed(6)} | ` +
          `Point=${updated.routeIndex}/` +
          `${updated.routeCoordinates.length - 1} | ` +
          `Distance=${
            (updated.distanceMeters / 1000)
              .toFixed(2)
          } km | ` +
          `ETA=${
            (updated.etaSeconds / 60)
              .toFixed(2)
          } min | ` +
          `Status=${updated.status}`
        );

      },

      {
        // 117 points would take ~23 seconds.
        intervalMs: 200
      }
    );


  console.log(
    "\n===================================="
  );

  console.log(
    "FINAL STATE"
  );

  console.log(
    "===================================="
  );

  console.dir(
    finalState,
    {
      depth: 2
    }
  );


  console.log(
    "\n✅ Real road simulation completed."
  );
}


testRealAmbulance()
  .then(() => process.exit(0))
  .catch(error => {

    console.error(
      "\n❌ Real ambulance simulation failed:"
    );

    console.error(error);

    process.exit(1);
  });