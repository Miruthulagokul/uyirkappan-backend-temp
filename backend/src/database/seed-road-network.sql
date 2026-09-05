-- ============================================================
-- UyirKappan Virtual Road Network
-- 25 nodes / grid-based simulation
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CREATE ROAD NODES
-- ============================================================

INSERT INTO road_nodes
    (node_code, location, node_type)
VALUES

-- Row 1
('N01', ST_SetSRID(ST_MakePoint(80.2700, 13.0800), 4326)::geography, 'JUNCTION'),
('N02', ST_SetSRID(ST_MakePoint(80.2750, 13.0800), 4326)::geography, 'JUNCTION'),
('N03', ST_SetSRID(ST_MakePoint(80.2800, 13.0800), 4326)::geography, 'JUNCTION'),
('N04', ST_SetSRID(ST_MakePoint(80.2850, 13.0800), 4326)::geography, 'JUNCTION'),
('N05', ST_SetSRID(ST_MakePoint(80.2900, 13.0800), 4326)::geography, 'JUNCTION'),

-- Row 2
('N06', ST_SetSRID(ST_MakePoint(80.2700, 13.0850), 4326)::geography, 'JUNCTION'),
('N07', ST_SetSRID(ST_MakePoint(80.2750, 13.0850), 4326)::geography, 'JUNCTION'),
('N08', ST_SetSRID(ST_MakePoint(80.2800, 13.0850), 4326)::geography, 'JUNCTION'),
('N09', ST_SetSRID(ST_MakePoint(80.2850, 13.0850), 4326)::geography, 'JUNCTION'),
('N10', ST_SetSRID(ST_MakePoint(80.2900, 13.0850), 4326)::geography, 'JUNCTION'),

-- Row 3
('N11', ST_SetSRID(ST_MakePoint(80.2700, 13.0900), 4326)::geography, 'JUNCTION'),
('N12', ST_SetSRID(ST_MakePoint(80.2750, 13.0900), 4326)::geography, 'JUNCTION'),
('N13', ST_SetSRID(ST_MakePoint(80.2800, 13.0900), 4326)::geography, 'JUNCTION'),
('N14', ST_SetSRID(ST_MakePoint(80.2850, 13.0900), 4326)::geography, 'JUNCTION'),
('N15', ST_SetSRID(ST_MakePoint(80.2900, 13.0900), 4326)::geography, 'JUNCTION'),

-- Row 4
('N16', ST_SetSRID(ST_MakePoint(80.2700, 13.0950), 4326)::geography, 'JUNCTION'),
('N17', ST_SetSRID(ST_MakePoint(80.2750, 13.0950), 4326)::geography, 'JUNCTION'),
('N18', ST_SetSRID(ST_MakePoint(80.2800, 13.0950), 4326)::geography, 'JUNCTION'),
('N19', ST_SetSRID(ST_MakePoint(80.2850, 13.0950), 4326)::geography, 'JUNCTION'),
('N20', ST_SetSRID(ST_MakePoint(80.2900, 13.0950), 4326)::geography, 'JUNCTION'),

-- Row 5
('N21', ST_SetSRID(ST_MakePoint(80.2700, 13.1000), 4326)::geography, 'JUNCTION'),
('N22', ST_SetSRID(ST_MakePoint(80.2750, 13.1000), 4326)::geography, 'JUNCTION'),
('N23', ST_SetSRID(ST_MakePoint(80.2800, 13.1000), 4326)::geography, 'JUNCTION'),
('N24', ST_SetSRID(ST_MakePoint(80.2850, 13.1000), 4326)::geography, 'JUNCTION'),
('N25', ST_SetSRID(ST_MakePoint(80.2900, 13.1000), 4326)::geography, 'JUNCTION')

ON CONFLICT (node_code) DO NOTHING;


-- ============================================================
-- 2. CREATE HORIZONTAL ROAD SEGMENTS
-- ============================================================

INSERT INTO road_segments
(
    segment_code,
    from_node_id,
    to_node_id,
    distance_meters,
    base_travel_time_seconds,
    geometry
)

SELECT
    'R-' || n1.node_code || '-' || n2.node_code,
    n1.node_id,
    n2.node_id,
    ST_Distance(n1.location, n2.location),
    GREATEST(
        30,
        ROUND(ST_Distance(n1.location, n2.location) / 11.11)
    )::INTEGER,
    ST_MakeLine(
        n1.location::geometry,
        n2.location::geometry
    )::geography

FROM road_nodes n1
JOIN road_nodes n2
    ON CAST(SUBSTRING(n2.node_code FROM 2) AS INTEGER)
       = CAST(SUBSTRING(n1.node_code FROM 2) AS INTEGER) + 1
WHERE
    CAST(SUBSTRING(n1.node_code FROM 2) AS INTEGER) % 5 <> 0

ON CONFLICT (segment_code) DO NOTHING;


-- ============================================================
-- 3. CREATE VERTICAL ROAD SEGMENTS
-- ============================================================

INSERT INTO road_segments
(
    segment_code,
    from_node_id,
    to_node_id,
    distance_meters,
    base_travel_time_seconds,
    geometry
)

SELECT
    'R-' || n1.node_code || '-' || n2.node_code,
    n1.node_id,
    n2.node_id,
    ST_Distance(n1.location, n2.location),
    GREATEST(
        30,
        ROUND(ST_Distance(n1.location, n2.location) / 11.11)
    )::INTEGER,
    ST_MakeLine(
        n1.location::geometry,
        n2.location::geometry
    )::geography

FROM road_nodes n1
JOIN road_nodes n2
    ON CAST(SUBSTRING(n2.node_code FROM 2) AS INTEGER)
       = CAST(SUBSTRING(n1.node_code FROM 2) AS INTEGER) + 5

ON CONFLICT (segment_code) DO NOTHING;


-- ============================================================
-- 4. MAKE THE ROAD NETWORK BIDIRECTIONAL
-- ============================================================

INSERT INTO road_segments
(
    segment_code,
    from_node_id,
    to_node_id,
    distance_meters,
    base_travel_time_seconds,
    geometry
)

SELECT
    'R-' || n2.node_code || '-' || n1.node_code,
    n2.node_id,
    n1.node_id,
    rs.distance_meters,
    rs.base_travel_time_seconds,
    ST_Reverse(rs.geometry::geometry)::geography

FROM road_segments rs
JOIN road_nodes n1
    ON rs.from_node_id = n1.node_id
JOIN road_nodes n2
    ON rs.to_node_id = n2.node_id
WHERE rs.segment_code LIKE 'R-N%-N%'

ON CONFLICT (segment_code) DO NOTHING;


-- ============================================================
-- 5. INITIAL TRAFFIC STATE
-- ============================================================

INSERT INTO traffic_states
(
    segment_id,
    state,
    multiplier
)

SELECT
    segment_id,
    'NORMAL',
    1.0

FROM road_segments rs

WHERE NOT EXISTS (
    SELECT 1
    FROM traffic_states ts
    WHERE ts.segment_id = rs.segment_id
);


COMMIT;