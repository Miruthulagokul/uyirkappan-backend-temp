import {
  calculateRoute
} from "./routing.service.js";

async function testRoutingService() {
  console.log(
    "Testing Routing Service..."
  );

  const result = await calculateRoute(
    {
      latitude: 13.0800,
      longitude: 80.2700
    },
    {
      latitude: 13.1000,
      longitude: 80.2900
    }
  );

  console.log("\nRoute Result:");

  console.dir(result, {
    depth: null
  });

  console.log(
    "\nRouting Service test completed."
  );
}

testRoutingService()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "\nRouting Service test failed:",
      error
    );

    process.exit(1);
  });