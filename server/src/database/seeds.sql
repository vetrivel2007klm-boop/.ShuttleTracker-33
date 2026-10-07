-- Seeds for ShuttleTrack Database

-- Hashed password for 'admin123', 'user123', 'driver123' (bcrypt)
-- Note: in Node.js server bcryptjs creates standard hashes; default test hash for 'password123':
-- $2a$10$wTqB4zXG28D89k6jXhUfDeq971FhW3j.r17B797B7b6d19j12k91K (or generated dynamically)

INSERT INTO users (id, name, email, password_hash, role, phone) VALUES
(1, 'Admin Controller', 'cleancodeuniverse@gmail.com', '$2a$10$Y1s47k6015hI7j.Xk95t9erZ7Z9rV9s1tZ8e1p3w1m5r5e9o9i3q2', 'admin', '+1 (555) 019-2834'),
(2, 'Sarah Jenkins (Student)', 'passenger@shuttletrack.com', '$2a$10$Y1s47k6015hI7j.Xk95t9erZ7Z9rV9s1tZ8e1p3w1m5r5e9o9i3q2', 'user', '+1 (555) 482-9901'),
(3, 'John Miller (Senior Driver)', 'driver.john@shuttletrack.com', '$2a$10$Y1s47k6015hI7j.Xk95t9erZ7Z9rV9s1tZ8e1p3w1m5r5e9o9i3q2', 'driver', '+1 (555) 302-8819'),
(4, 'Sarah Davis (Driver)', 'driver.sarah@shuttletrack.com', '$2a$10$Y1s47k6015hI7j.Xk95t9erZ7Z9rV9s1tZ8e1p3w1m5r5e9o9i3q2', 'driver', '+1 (555) 392-4412'),
(5, 'Michael Chang (Driver)', 'driver.mike@shuttletrack.com', '$2a$10$Y1s47k6015hI7j.Xk95t9erZ7Z9rV9s1tZ8e1p3w1m5r5e9o9i3q2', 'driver', '+1 (555) 881-2291')
ON CONFLICT (email) DO NOTHING;

INSERT INTO drivers (id, user_id, license_number, experience_years, status, rating, phone) VALUES
(1, 3, 'DL-9948201', 7, 'on_duty', 4.95, '+1 (555) 302-8819'),
(2, 4, 'DL-8839102', 4, 'on_duty', 4.88, '+1 (555) 392-4412'),
(3, 5, 'DL-4410984', 5, 'available', 4.92, '+1 (555) 881-2291')
ON CONFLICT (license_number) DO NOTHING;

INSERT INTO routes (id, name, code, description, start_point, end_point, distance_km, estimated_time_minutes, color, is_active) VALUES
(1, 'Hostel - Main Campus Loop', 'RT-01', 'Connects student residential dorms to central academic blocks & library', 'Hostel Complex', 'Main Gate', 4.2, 18, '#2563EB', true),
(2, 'North Tech Corridor', 'RT-02', 'High-frequency shuttle between Science Complex, Engineering & Gate 2', 'Gate 2 Terminal', 'Academic Block', 3.8, 14, '#0ea5e9', true),
(3, 'South Campus & Sports Link', 'RT-03', 'Covers athletic facilities, south cafeteria and parking sectors', 'Sports Arena', 'Metro Station Link', 5.5, 22, '#10b981', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO stops (id, route_id, name, sequence_order, latitude, longitude, landmark) VALUES
(1, 1, 'Hostel Complex Terminal', 1, 12.9716, 77.5946, 'Opposite Block B Residence'),
(2, 1, 'Main Gate Plaza', 2, 12.9745, 77.5992, 'Security Checkpoint & Transit Bay'),
(3, 1, 'Academic Block Center', 3, 12.9782, 77.6035, 'Near Auditorium Entrance'),
(4, 1, 'Central Library & Media Hub', 4, 12.9818, 77.6078, 'East Wing Roundabout'),
(5, 1, 'Sports Ground & Arena', 5, 12.9855, 77.6115, 'Pavilion Gates')
ON CONFLICT DO NOTHING;

INSERT INTO shuttles (id, code, name, vehicle_number, capacity, status, current_lat, current_lng, current_route_id, current_driver_id, speed, heading, eta_minutes) VALUES
(1, 'S01', 'Campus Express Blue', 'KA-01-EQ-4421', 36, 'on_trip', 12.9752, 77.6001, 1, 3, 28.5, 65.0, 4),
(2, 'S02', 'North Ring Cruiser', 'KA-01-EQ-8812', 32, 'delayed', 12.9789, 77.6042, 2, 4, 14.0, 110.0, 8),
(3, 'S03', 'Metro Rapid Link', 'KA-01-EQ-9903', 40, 'active', 12.9716, 77.5946, 3, 5, 0.0, 0.0, 12),
(4, 'S04', 'Executive Transit Van', 'KA-01-EQ-3024', 24, 'inactive', 12.9700, 77.5900, NULL, NULL, 0.0, 0.0, 0)
ON CONFLICT (code) DO NOTHING;

INSERT INTO notifications (id, user_id, shuttle_id, title, message, type, is_read) VALUES
(1, NULL, 1, 'Approaching Main Gate', 'Shuttle S01 is approaching Main Gate Plaza in approximately 4 minutes.', 'info', false),
(2, NULL, 2, 'Route Delay Advisory', 'Shuttle S02 is experiencing heavy campus pedestrian traffic. Delayed by 8 mins.', 'delay', false),
(3, NULL, 3, 'Service Started', 'Shuttle S03 has commenced its scheduled run on the South Campus & Sports Link.', 'success', true),
(4, NULL, NULL, 'Campus Maintenance Notice', 'East gate road repaving today from 2 PM. Shuttles temporarily rerouted through North Circle.', 'warning', false)
ON CONFLICT DO NOTHING;
