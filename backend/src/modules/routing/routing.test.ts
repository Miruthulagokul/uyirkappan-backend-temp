import { loadRoadGraph } from "./graph.service.js";
import { dijkstra } from "./dijkstra.service.js";

async function testRouting() {
  console.log("Loading road graph...");

  const graph = await loadRoadGraph();

  console.log(`Nodes: ${graph.nodes.size}`);

  let edgeCount = 0;

  for (const edges of graph.adjacencyList.values()) {
    edgeCount += edges.length;
  }

  console.log(`Edges: ${edgeCount}`);

  const nodes = [...graph.nodes.keys()];

  const startNode = nodes.find(
    (id) => graph.nodes.get(id)?.code === "N01"
  );

  const destinationNode = nodes.find(
    (id) => graph.nodes.get(id)?.code === "N25"
  );

  if (!startNode || !destinationNode) {
    throw new Error("Test nodes not found");
  }

  const result = dijkstra(
    graph,
    startNode,
    destinationNode
  );

  console.log("\nDijkstra Result:");

  console.dir(result, {
    depth: null
  });
}

testRouting()
  .then(() => {
    console.log("\nRouting test completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nRouting test failed:", error);
    process.exit(1);
  });