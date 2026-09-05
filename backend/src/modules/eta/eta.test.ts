import {
  calculateEta
} from "./eta.service.js";

async function testEta() {
  console.log(
    "Testing Dynamic ETA..."
  );

  const result =
    await calculateEta(
      "N01",
      "N25"
    );

  console.log("\nETA Result:");

  console.dir(
    result,
    { depth: null }
  );

  if (result) {
    console.log(
      `\nETA: ${
        result.etaSeconds
      } seconds`
    );

    console.log(
      `ETA: ${
        (
          result.etaSeconds / 60
        ).toFixed(2)
      } minutes`
    );
  }

  console.log(
    "\nETA test completed."
  );
}

testEta()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "\nETA test failed:",
      error
    );

    process.exit(1);
  });
  