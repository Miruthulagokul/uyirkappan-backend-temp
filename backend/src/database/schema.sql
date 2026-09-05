-- ============================================================
-- UyirKappan
-- Module 5: Intelligent Dispatch Engine
-- Module 6: Live Tracking, ETA & Cascading Fallback
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 2. EMERGENCY REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS emergency_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    emergency_type VARCHAR(50) NOT NULL,

    victim_count INTEGER NOT NULL DEFAULT 1
        CHECK (victim_count > 0),

    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,

    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),

    status VARCHAR(40) NOT NULL DEFAULT 'REQUESTED'
        CHECK (
            status IN (
                'REQUESTED',
                'ASSIGNED',
                'ACCEPTED',
                'EN_ROUTE_TO_PATIENT',
                'ARRIVED_AT_PATIENT',
                'PATIENT_ONBOARD',
                'EN_ROUTE_TO_HOSPITAL',
                'ARRIVED_AT_HOSPITAL',
                'COMPLETED',
                'NO_AMBULANCE_AVAILABLE',
                'CANCELLED'
            )
        ),

    current_ambulance_id UUID,

    current_eta_seconds INTEGER
        CHECK (current_eta_seconds IS NULL OR current_eta_seconds >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. AMBULANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS ambulances (
    ambulance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ambulance_code VARCHAR(30) NOT NULL UNIQUE,

    current_location GEOGRAPHY(POINT, 4326) NOT NULL,

    availability_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (
            availability_status IN (
                'AVAILABLE',
                'ASSIGNED',
                'BUSY',
                'OFFLINE',
                'MAINTENANCE'
            )
        ),

    current_request_id UUID,

    driver_id VARCHAR(100),

    capabilities JSONB NOT NULL DEFAULT '{}'::JSONB,

    last_location_update TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 4. ROAD NODES
-- ============================================================

CREATE TABLE IF NOT EXISTS road_nodes (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    node_code VARCHAR(50) NOT NULL UNIQUE,

    location GEOGRAPHY(POINT, 4326) NOT NULL,

    node_type VARCHAR(30) NOT NULL DEFAULT 'JUNCTION'
        CHECK (
            node_type IN (
                'JUNCTION',
                'INTERSECTION',
                'HOSPITAL',
                'EMERGENCY_POINT',
                'OTHER'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 5. ROAD SEGMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS road_segments (
    segment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    segment_code VARCHAR(50) NOT NULL UNIQUE,

    from_node_id UUID NOT NULL
        REFERENCES road_nodes(node_id),

    to_node_id UUID NOT NULL
        REFERENCES road_nodes(node_id),

    distance_meters DOUBLE PRECISION NOT NULL
        CHECK (distance_meters > 0),

    base_travel_time_seconds INTEGER NOT NULL
        CHECK (base_travel_time_seconds > 0),

    geometry GEOGRAPHY(LINESTRING, 4326),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT different_road_nodes
        CHECK (from_node_id <> to_node_id)
);


-- ============================================================
-- 6. TRAFFIC STATES
-- ============================================================

CREATE TABLE IF NOT EXISTS traffic_states (
    traffic_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    segment_id UUID NOT NULL
        REFERENCES road_segments(segment_id)
        ON DELETE CASCADE,

    state VARCHAR(20) NOT NULL
        CHECK (
            state IN (
                'NORMAL',
                'MODERATE',
                'HEAVY',
                'BLOCKED'
            )
        ),

    multiplier DOUBLE PRECISION NOT NULL
        CHECK (multiplier > 0),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ
);


-- ============================================================
-- 7. DISPATCH DECISIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatch_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id UUID NOT NULL
        REFERENCES emergency_requests(request_id)
        ON DELETE CASCADE,

    selected_ambulance_id UUID
        REFERENCES ambulances(ambulance_id),

    estimated_travel_time_seconds INTEGER
        CHECK (
            estimated_travel_time_seconds IS NULL
            OR estimated_travel_time_seconds >= 0
        ),

    distance_meters DOUBLE PRECISION
        CHECK (
            distance_meters IS NULL
            OR distance_meters >= 0
        ),

    score DOUBLE PRECISION,

    route JSONB,

    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 8. ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id UUID NOT NULL
        REFERENCES emergency_requests(request_id)
        ON DELETE CASCADE,

    ambulance_id UUID NOT NULL
        REFERENCES ambulances(ambulance_id),

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'ACCEPTED',
                'REJECTED',
                'TIMEOUT',
                'CANCELLED',
                'COMPLETED'
            )
        ),

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    responded_at TIMESTAMPTZ,

    response VARCHAR(20)
        CHECK (
            response IS NULL
            OR response IN (
                'ACCEPTED',
                'REJECTED',
                'TIMEOUT'
            )
        ),

    failure_reason TEXT,

    expires_at TIMESTAMPTZ
);


-- ============================================================
-- 9. ASSIGNMENT ATTEMPTS
-- ============================================================

CREATE TABLE IF NOT EXISTS assignment_attempts (
    attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id UUID NOT NULL
        REFERENCES emergency_requests(request_id)
        ON DELETE CASCADE,

    attempt_number INTEGER NOT NULL
        CHECK (attempt_number > 0),

    ambulance_id UUID NOT NULL
        REFERENCES ambulances(ambulance_id),

    assignment_id UUID
        REFERENCES assignments(assignment_id),

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    response_at TIMESTAMPTZ,

    response VARCHAR(20)
        CHECK (
            response IS NULL
            OR response IN (
                'ACCEPTED',
                'REJECTED',
                'TIMEOUT'
            )
        ),

    failure_reason TEXT,

    UNIQUE (request_id, attempt_number)
);


-- ============================================================
-- 10. LOCATION HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS location_history (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ambulance_id UUID NOT NULL
        REFERENCES ambulances(ambulance_id)
        ON DELETE CASCADE,

    request_id UUID
        REFERENCES emergency_requests(request_id)
        ON DELETE SET NULL,

    location GEOGRAPHY(POINT, 4326) NOT NULL,

    speed_kmh DOUBLE PRECISION
        CHECK (
            speed_kmh IS NULL
            OR speed_kmh >= 0
        ),

    heading DOUBLE PRECISION
        CHECK (
            heading IS NULL
            OR (heading >= 0 AND heading <= 360)
        ),

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 11. INDEXES
-- ============================================================

-- Emergency location
CREATE INDEX IF NOT EXISTS idx_emergency_pickup_location
ON emergency_requests
USING GIST (pickup_location);


-- Ambulance location
CREATE INDEX IF NOT EXISTS idx_ambulance_current_location
ON ambulances
USING GIST (current_location);


-- Available ambulance lookup
CREATE INDEX IF NOT EXISTS idx_ambulance_availability
ON ambulances (availability_status);


-- Road node location
CREATE INDEX IF NOT EXISTS idx_road_node_location
ON road_nodes
USING GIST (location);


-- Road segment endpoints
CREATE INDEX IF NOT EXISTS idx_road_segment_from_node
ON road_segments (from_node_id);

CREATE INDEX IF NOT EXISTS idx_road_segment_to_node
ON road_segments (to_node_id);


-- Road geometry
CREATE INDEX IF NOT EXISTS idx_road_segment_geometry
ON road_segments
USING GIST (geometry);


-- Traffic lookup
CREATE INDEX IF NOT EXISTS idx_traffic_segment
ON traffic_states (segment_id);


-- Assignment lookup
CREATE INDEX IF NOT EXISTS idx_assignment_request
ON assignments (request_id);

CREATE INDEX IF NOT EXISTS idx_assignment_ambulance
ON assignments (ambulance_id);


-- Attempt history
CREATE INDEX IF NOT EXISTS idx_attempt_request
ON assignment_attempts (request_id);


-- Location history
CREATE INDEX IF NOT EXISTS idx_location_history_ambulance
ON location_history (ambulance_id);

CREATE INDEX IF NOT EXISTS idx_location_history_request
ON location_history (request_id);

CREATE INDEX IF NOT EXISTS idx_location_history_recorded_at
ON location_history (recorded_at);


-- ============================================================
-- 12. UNIQUE ACTIVE ASSIGNMENT SAFEGUARD
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_assignment_per_request
ON assignments (request_id)
WHERE status IN ('PENDING', 'ACCEPTED');