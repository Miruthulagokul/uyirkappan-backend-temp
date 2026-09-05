# UyirKappan - Intelligent Dispatch and Live Tracking Backend

UyirKappan is an intelligent ambulance dispatch and live tracking backend system designed to optimize emergency response times. It provides real-time routing, dynamic Estimated Time of Arrival (ETA) calculation, simulation for testing, and live tracking capabilities using WebSockets.

## Features

- **Intelligent Dispatch**: Automated assignment of the nearest available ambulance to emergencies.
- **Advanced Routing**: 
  - Integrated with **OSRM** (Open Source Routing Machine) for real-world road networks.
  - Custom **Dijkstra** algorithm implementations for fallback and specialized graph routing.
- **Dynamic ETA Calculation**: Real-time ETA updates factoring in live traffic and route conditions.
- **Live Tracking System**: Real-time websocket-based (Socket.IO) location tracking of ambulances.
- **Simulation Environment**: Built-in support for "Virtual Ambulances" and "Real Ambulances" to test routing and dispatch logic under various scenarios.

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **WebSockets**: Socket.IO for real-time tracking updates
- **Database**: PostgreSQL (with `pg` driver) for storing road networks, ambulance state, and emergency requests

## Project Structure

```text
src/
├── app.ts                  # Express application setup
├── server.ts               # Server initialization and Socket.IO attachment
├── config/
│   └── database.ts         # PostgreSQL database connection configuration
├── database/
│   ├── schema.sql          # Database schema definitions
│   └── seed-road-network.sql # Initial data seeding for the routing graph
└── modules/
    ├── assignment/         # Ambulance selection and assignment logic
    ├── dispatch/           # Core dispatch request handling
    ├── eta/                # Dynamic and standard ETA calculations
    ├── fallback/           # Fallback services for routing and ETA
    ├── routing/            # OSRM and custom Graph (Dijkstra) routing services
    ├── simulation/         # Virtual & real ambulance simulation logic
    ├── tracking/           # Real-time location streaming
    └── traffic/            # Traffic data structures and types
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- PostgreSQL
- OSRM Backend (optional but recommended for real routing)

### Installation

1. Clone the repository and navigate to the backend directory.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` file in the root directory with necessary configurations (Database URL, Port, OSRM URL, etc.).
4. Initialize the database by running the scripts in `src/database/schema.sql` and `src/database/seed-road-network.sql`.

### Running the Application

**Development Mode** (with hot-reloading via `tsx`):
```bash
npm run dev
```

**Production Build**:
```bash
npm run build
npm start
```

## Module Highlights

- **Routing Module**: Central to the system, capable of switching between standard Dijkstra algorithm on an internal graph and OSRM for precise street-level routing.
- **Simulation Module**: Extremely useful for development, allowing you to spawn virtual ambulances (`virtual-ambulance.service.ts`) that move along calculated routes and emit telemetry data, enabling end-to-end testing without physical hardware.
- **Tracking Module**: Uses `realtime-simulation.service.ts` to broadcast location updates to the frontend dispatchers and requesters.
