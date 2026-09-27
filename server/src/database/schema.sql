-- PostgreSQL + PostGIS Schema for ShuttleTrack

-- Optional PostGIS extension (gracefully skipped if not installed on basic cloud instances)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS extension not available on this instance; using native DOUBLE PRECISION coordinates.';
END $$;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user', 'driver')),
    phone VARCHAR(30),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Drivers Table (extends driver role users)
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    experience_years INT DEFAULT 3,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'on_duty', 'off_duty')),
    rating NUMERIC(3, 2) DEFAULT 4.9,
    phone VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Routes Table
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    start_point VARCHAR(100) NOT NULL,
    end_point VARCHAR(100) NOT NULL,
    distance_km NUMERIC(5, 2) DEFAULT 4.5,
    estimated_time_minutes INT DEFAULT 20,
    color VARCHAR(20) DEFAULT '#2563EB',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Stops Table
CREATE TABLE IF NOT EXISTS stops (
    id SERIAL PRIMARY KEY,
    route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sequence_order INT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    landmark VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Shuttles Table
CREATE TABLE IF NOT EXISTS shuttles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL, -- e.g. S01, S02
    name VARCHAR(100) NOT NULL,
    vehicle_number VARCHAR(50) UNIQUE NOT NULL,
    capacity INT DEFAULT 32,
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'on_trip', 'delayed')),
    current_lat DOUBLE PRECISION DEFAULT 12.9716,
    current_lng DOUBLE PRECISION DEFAULT 77.5946,
    current_route_id INT REFERENCES routes(id) ON DELETE SET NULL,
    current_driver_id INT REFERENCES users(id) ON DELETE SET NULL,
    speed NUMERIC(5, 2) DEFAULT 0.0,
    heading NUMERIC(5, 2) DEFAULT 0.0,
    next_stop_id INT REFERENCES stops(id) ON DELETE SET NULL,
    eta_minutes INT DEFAULT 4,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    shuttle_id INT NOT NULL REFERENCES shuttles(id) ON DELETE CASCADE,
    driver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    passenger_count INT DEFAULT 18,
    delay_minutes INT DEFAULT 0,
    current_stop_id INT REFERENCES stops(id) ON DELETE SET NULL
);

-- 7. Location Updates (Time-series / historical breadcrumb)
CREATE TABLE IF NOT EXISTS location_updates (
    id SERIAL PRIMARY KEY,
    trip_id INT REFERENCES trips(id) ON DELETE CASCADE,
    shuttle_id INT NOT NULL REFERENCES shuttles(id) ON DELETE CASCADE,
    driver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed NUMERIC(5, 2) DEFAULT 0.0,
    heading NUMERIC(5, 2) DEFAULT 0.0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    shuttle_id INT REFERENCES shuttles(id) ON DELETE SET NULL,
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    days_of_week VARCHAR(50) DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    status VARCHAR(20) DEFAULT 'active'
);

-- 9. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- NULL means broadcast
    shuttle_id INT REFERENCES shuttles(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'delay', 'emergency', 'success')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_shuttles_code ON shuttles(code);
CREATE INDEX IF NOT EXISTS idx_shuttles_status ON shuttles(status);
CREATE INDEX IF NOT EXISTS idx_stops_route_id ON stops(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_shuttle ON trips(shuttle_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_shuttle ON location_updates(shuttle_id);
