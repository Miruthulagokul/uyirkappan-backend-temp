import dotenv from "dotenv";

import {
  httpServer
} from "./app.js";

dotenv.config();

const PORT =
  Number(process.env.PORT) || 5000;


httpServer.listen(
  PORT,
  () => {

    console.log(
      `UyirKappan backend running on port ${PORT}`
    );

    console.log(
      "Socket.IO real-time server ready"
    );

  }
);