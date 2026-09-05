import express from "express";
import cors from "cors";
import pool from "./config/database.js";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";

import trackingRoutes from "./modules/tracking/tracking.routes.js";


const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(
  express.json()
);


// =====================================================
// STATIC FRONTEND
// =====================================================

app.use(
  express.static(
    path.join(
      process.cwd(),
      "public"
    )
  )
);


// =====================================================
// API ROUTES
// =====================================================

app.use(
  "/api/tracking",
  trackingRoutes
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/health",
  (_req, res) => {

    res.json({

      success: true,

      service:
        "UyirKappan Backend",

      status:
        "UP"

    });

  }
);


// =====================================================
// DATABASE HEALTH CHECK
// =====================================================

app.get(
  "/health/db",
  async (_req, res) => {

    try {

      const result =
        await pool.query(
          "SELECT NOW() AS current_time"
        );


      res.json({

        success: true,

        database:
          "CONNECTED",

        time:
          result.rows[0].current_time

      });

    } catch (error) {

      console.error(
        "Database connection failed:",
        error
      );


      res.status(500).json({

        success: false,

        database:
          "DISCONNECTED"

      });

    }

  }
);


// =====================================================
// HTTP SERVER
// =====================================================

const httpServer =
  createServer(app);


// =====================================================
// SOCKET.IO
// =====================================================

const io =
  new Server(
    httpServer,
    {
      cors: {
        origin: "*"
      }
    }
  );


// =====================================================
// SOCKET EVENTS
// =====================================================

io.on(
  "connection",
  socket => {

    console.log(
      `Socket connected: ${socket.id}`
    );


    // -----------------------------------------------
    // JOIN EMERGENCY ROOM
    // -----------------------------------------------

    socket.on(
      "join-emergency",
      async (
        requestId: string
      ) => {

        socket.join(
          `emergency:${requestId}`
        );


        console.log(
          `Socket ${socket.id} joined emergency:${requestId}`
        );


        /*
         * Start the demo ambulance only when
         * the browser actually joins the emergency.
         */

        if (
          requestId ===
          "REAL-SIM-001"
        ) {

          console.log(
            "🚑 Browser connected to REAL-SIM-001"
          );


          try {

            const {
              startRealtimeSimulation
            } =
              await import(
                "./modules/tracking/realtime-simulation.service.js"
              );


            await startRealtimeSimulation();

          } catch (error) {

            console.error(
              "Failed to start realtime simulation:",
              error
            );

          }

        }

      }
    );


    // -----------------------------------------------
    // DISCONNECT
    // -----------------------------------------------

    socket.on(
      "disconnect",
      () => {

        console.log(
          `Socket disconnected: ${socket.id}`
        );

      }
    );

  }
);


// =====================================================
// EXPORTS
// =====================================================

export {
  app,
  httpServer,
  io
};