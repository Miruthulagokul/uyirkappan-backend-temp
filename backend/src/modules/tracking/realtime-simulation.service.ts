import {
  io
} from "../../app.js";


import {
  createRealAmbulance,
  runRealAmbulanceSimulation
} from "../simulation/real-ambulance.service.js";


let simulationRunning =
  false;


/* =====================================================
   START REALTIME SIMULATION
   ===================================================== */

export async function startRealtimeSimulation() {


  if (
    simulationRunning
  ) {

    console.log(
      "⚠️ Realtime simulation already running."
    );

    return;

  }


  simulationRunning =
    true;


  try {


    const ambulance =
      await createRealAmbulance({

        ambulanceId:
          "A1",

        requestId:
          "REAL-SIM-001",


        startLocation: {

          latitude:
            13.0827,

          longitude:
            80.2707

        },


        destinationLocation: {

          latitude:
            13.1000,

          longitude:
            80.2900

        }

      });


    console.log(
      "\n🚑 Starting realtime ambulance simulation..."
    );


    await runRealAmbulanceSimulation(

      ambulance,


      updatedAmbulance => {


        const payload = {

          ambulanceId:
            updatedAmbulance.ambulanceId,


          requestId:
            updatedAmbulance.requestId,


          latitude:
            updatedAmbulance.latitude,


          longitude:
            updatedAmbulance.longitude,


          distanceMeters:
            updatedAmbulance.distanceMeters,


          etaSeconds:
            updatedAmbulance.etaSeconds,


          speedKmh:
            updatedAmbulance.speedKmh,


          heading:
            updatedAmbulance.heading,


          trafficCondition:
            updatedAmbulance.trafficCondition,


          trafficMultiplier:
            updatedAmbulance.trafficMultiplier,


          status:
            updatedAmbulance.status,


          timestamp:
            new Date().toISOString()

        };


        console.log(

          `📡 LIVE GPS | ` +

          `Lat=${payload.latitude.toFixed(6)} | ` +

          `Lng=${payload.longitude.toFixed(6)} | ` +

          `Speed=${payload.speedKmh.toFixed(1)} km/h | ` +

          `Heading=${payload.heading.toFixed(0)}° | ` +

          `Distance=${(
            payload.distanceMeters / 1000
          ).toFixed(2)} km | ` +

          `ETA=${(
            payload.etaSeconds / 60
          ).toFixed(2)} min | ` +

          `Traffic=${payload.trafficCondition} | ` +

          `Status=${payload.status}`

        );


        /*
         * Broadcast to every client
         * watching this emergency.
         */

        io
          .to(
            `emergency:${payload.requestId}`
          )
          .emit(
            "ambulance-update",
            payload
          );

      },


      {

        intervalMs:
          200

      }

    );


    console.log(
      "✅ Realtime ambulance simulation completed."
    );


  } catch (error) {


    console.error(
      "❌ Realtime simulation failed:",
      error
    );


  } finally {

    simulationRunning =
      false;

  }

}