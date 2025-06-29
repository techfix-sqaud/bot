-- ============================================================================
-- DEALERSHIP AUCTION DATA MANAGEMENT SYSTEM
-- Core schema for managing dealerships, vehicles, auction data, and inventory
-- ============================================================================

-- ============================================================================
-- DOMAIN TYPES AND ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'dealer');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'suspended');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
CREATE TYPE payment_method AS ENUM ('credit_card', 'paypal', 'bank_transfer', 'check');
CREATE TYPE vehicle_status AS ENUM ('available', 'sold', 'pending', 'reserved', 'archived');
CREATE TYPE auction_status AS ENUM ('upcoming', 'active', 'completed', 'cancelled');

-- ============================================================================
-- CORE ENTITY TABLES
-- ============================================================================

-- Users: Core authentication and authorization
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'dealer',
    status user_status NOT NULL DEFAULT 'pending_verification',
    last_login TIMESTAMPTZ,
    validation_code VARCHAR(255),
    validation_code_expires_at TIMESTAMPTZ,
    auth_token VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Dealerships: Business entities that manage vehicle inventory
CREATE TABLE dealerships (
    dealership_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    ein VARCHAR(20) NOT NULL, -- Employer Identification Number
    street_address VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    website_url VARCHAR(255),
    license_number VARCHAR(100),
    created_by INT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Auction Houses: External sources of vehicle data
CREATE TABLE auction_houses (
    auction_house_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    website_url VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles: Core vehicle information with auction integration
CREATE TABLE vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    vin VARCHAR(17) UNIQUE NOT NULL,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year SMALLINT NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 2),
    trim VARCHAR(100),
    body_style VARCHAR(50),
    exterior_color VARCHAR(50),
    interior_color VARCHAR(50),
    engine VARCHAR(100),
    transmission VARCHAR(100),
    drivetrain VARCHAR(50),
    fuel_type VARCHAR(30),
    mileage INTEGER CHECK (mileage >= 0),
    -- Auction-specific fields
    auction_house_id INT REFERENCES auction_houses(auction_house_id),
    run_number VARCHAR(100),
    lot_number VARCHAR(100),
    auction_date DATE,
    auction_location VARCHAR(255),
    condition_grade VARCHAR(10),
    seller_type VARCHAR(50),
    -- Data management
    data_source VARCHAR(50) DEFAULT 'manual',
    scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Dealership Inventory: Links vehicles to dealerships with pricing and status
CREATE TABLE dealership_inventory (
    inventory_id SERIAL PRIMARY KEY,
    dealership_id INT NOT NULL REFERENCES dealerships(dealership_id) ON DELETE CASCADE,
    vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    asking_price DECIMAL(12, 2),
    cost_basis DECIMAL(12, 2),
    status vehicle_status NOT NULL DEFAULT 'available',
    acquisition_date DATE,
    listing_date DATE,
    days_in_inventory INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN listing_date IS NOT NULL 
            THEN CURRENT_DATE - listing_date 
            ELSE NULL 
        END
    ) STORED,
    internal_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dealership_id, vehicle_id)
);

-- ============================================================================
-- SUPPORTING TABLES
-- ============================================================================

-- Subscription Plans: Service tiers for dealerships
CREATE TABLE subscription_plans (
    plan_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    monthly_price DECIMAL(10, 2) NOT NULL,
    max_vehicles INTEGER,
    max_users INTEGER,
    features JSONB, -- Store feature flags as JSON
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Dealership Subscriptions: Active subscriptions
CREATE TABLE dealership_subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    dealership_id INT NOT NULL REFERENCES dealerships(dealership_id) ON DELETE CASCADE,
    plan_id INT NOT NULL REFERENCES subscription_plans(plan_id),
    start_date DATE NOT NULL,
    end_date DATE,
    status subscription_status NOT NULL DEFAULT 'active',
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User Dealership Access: Many-to-many relationship for user access
CREATE TABLE user_dealership_access (
    access_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    dealership_id INT NOT NULL REFERENCES dealerships(dealership_id) ON DELETE CASCADE,
    granted_by INT REFERENCES users(user_id),
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    UNIQUE(user_id, dealership_id)
);

-- Vehicle Price History: Track pricing changes over time
CREATE TABLE vehicle_price_history (
    price_history_id SERIAL PRIMARY KEY,
    inventory_id INT NOT NULL REFERENCES dealership_inventory(inventory_id) ON DELETE CASCADE,
    old_price DECIMAL(12, 2),
    new_price DECIMAL(12, 2) NOT NULL,
    price_change_reason VARCHAR(255),
    changed_by INT REFERENCES users(user_id),
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Data Scraping Jobs: Track automated data collection
CREATE TABLE scraping_jobs (
    job_id SERIAL PRIMARY KEY,
    auction_house_id INT REFERENCES auction_houses(auction_house_id),
    job_type VARCHAR(50) NOT NULL, -- 'full_scan', 'incremental', 'specific_vin'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    vehicles_processed INTEGER DEFAULT 0,
    vehicles_added INTEGER DEFAULT 0,
    vehicles_updated INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CORE BUSINESS FUNCTIONS
-- ============================================================================

-- Calculate vehicle age in years
CREATE OR REPLACE FUNCTION calculate_vehicle_age(vehicle_year INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM CURRENT_DATE) - vehicle_year;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate vehicle display name (Year Make Model Trim)
CREATE OR REPLACE FUNCTION generate_vehicle_display_name(
    p_year INTEGER,
    p_make VARCHAR,
    p_model VARCHAR,
    p_trim VARCHAR DEFAULT NULL
)
RETURNS VARCHAR AS $$
BEGIN
    RETURN CASE 
        WHEN p_trim IS NOT NULL AND p_trim != '' 
        THEN p_year || ' ' || p_make || ' ' || p_model || ' ' || p_trim
        ELSE p_year || ' ' || p_make || ' ' || p_model
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dealerships_updated_at 
    BEFORE UPDATE ON dealerships 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at 
    BEFORE UPDATE ON vehicles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dealership_inventory_updated_at 
    BEFORE UPDATE ON dealership_inventory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dealership_subscriptions_updated_at 
    BEFORE UPDATE ON dealership_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to log price changes
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.asking_price IS DISTINCT FROM NEW.asking_price THEN
        INSERT INTO vehicle_price_history (
            inventory_id, old_price, new_price, price_change_reason
        ) VALUES (
            NEW.inventory_id, OLD.asking_price, NEW.asking_price, 
            'Automatic price update'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_inventory_price_changes
    AFTER UPDATE ON dealership_inventory
    FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Core entity indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_dealerships_created_by ON dealerships(created_by);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_house ON vehicles(auction_house_id);
CREATE INDEX idx_vehicles_auction_date ON vehicles(auction_date);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);

-- Inventory and business logic indexes
CREATE INDEX idx_dealership_inventory_dealership ON dealership_inventory(dealership_id);
CREATE INDEX idx_dealership_inventory_vehicle ON dealership_inventory(vehicle_id);
CREATE INDEX idx_dealership_inventory_status ON dealership_inventory(status);
CREATE INDEX idx_dealership_inventory_listing_date ON dealership_inventory(listing_date);
CREATE INDEX idx_user_dealership_access_user ON user_dealership_access(user_id);
CREATE INDEX idx_user_dealership_access_dealership ON user_dealership_access(dealership_id);
CREATE INDEX idx_subscription_status ON dealership_subscriptions(status, end_date);
CREATE INDEX idx_price_history_inventory ON vehicle_price_history(inventory_id);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status, created_at);

-- ============================================================================
-- USEFUL VIEWS FOR BUSINESS OPERATIONS
-- ============================================================================

-- Active dealership inventory with vehicle details
CREATE VIEW active_inventory AS
SELECT 
    di.inventory_id,
    di.dealership_id,
    d.name AS dealership_name,
    v.vin,
    generate_vehicle_display_name(v.year, v.make, v.model, v.trim) AS vehicle_name,
    v.year,
    v.make,
    v.model,
    v.trim,
    v.mileage,
    di.asking_price,
    di.cost_basis,
    di.status,
    di.listing_date,
    di.days_in_inventory,
    CASE 
        WHEN di.asking_price > 0 AND di.cost_basis > 0 
        THEN ROUND(((di.asking_price - di.cost_basis) / di.cost_basis * 100), 2)
        ELSE NULL 
    END AS markup_percentage
FROM dealership_inventory di
JOIN dealerships d ON di.dealership_id = d.dealership_id
JOIN vehicles v ON di.vehicle_id = v.vehicle_id
WHERE di.status IN ('available', 'pending', 'reserved');

-- Dealership summary statistics
CREATE VIEW dealership_stats AS
SELECT 
    d.dealership_id,
    d.name,
    COUNT(di.inventory_id) AS total_vehicles,
    COUNT(CASE WHEN di.status = 'available' THEN 1 END) AS available_vehicles,
    COUNT(CASE WHEN di.status = 'sold' THEN 1 END) AS sold_vehicles,
    AVG(di.asking_price) AS avg_asking_price,
    AVG(di.days_in_inventory) AS avg_days_in_inventory,
    MAX(di.updated_at) AS last_inventory_update
FROM dealerships d
LEFT JOIN dealership_inventory di ON d.dealership_id = di.dealership_id
GROUP BY d.dealership_id, d.name;

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Sample subscription plans
INSERT INTO subscription_plans (name, description, monthly_price, max_vehicles, max_users, features) VALUES
('Basic', 'Perfect for small dealerships', 49.99, 50, 2, '{"basic_search": true, "price_alerts": false, "api_access": false}'),
('Professional', 'Great for growing dealerships', 149.99, 200, 5, '{"basic_search": true, "price_alerts": true, "api_access": true, "advanced_filters": true}'),
('Enterprise', 'For large dealership groups', 399.99, 1000, 20, '{"basic_search": true, "price_alerts": true, "api_access": true, "advanced_filters": true, "white_label": true, "priority_support": true}');

-- Sample auction house
INSERT INTO auction_houses (name, website_url, location, contact_email) VALUES
('Manheim Louisville', 'https://www.manheim.com', 'Louisville, KY', 'info@manheim.com'),
('ADESA Indianapolis', 'https://www.adesa.com', 'Indianapolis, IN', 'info@adesa.com');

-- ============================================================================
-- SAMPLE USAGE QUERIES
-- ============================================================================

-- Find all available vehicles for a specific dealership
/*
SELECT * FROM active_inventory 
WHERE dealership_id = 1 AND status = 'available'
ORDER BY listing_date DESC;
*/

-- Get dealership performance summary
/*
SELECT * FROM dealership_stats 
WHERE dealership_id = 1;
*/

-- Find vehicles by make and model within price range
/*
SELECT v.vin, generate_vehicle_display_name(v.year, v.make, v.model, v.trim) as name,
       v.mileage, di.asking_price, di.days_in_inventory
FROM vehicles v
JOIN dealership_inventory di ON v.vehicle_id = di.vehicle_id
WHERE v.make = 'Ford' 
  AND v.model = 'Fusion'
  AND di.asking_price BETWEEN 15000 AND 25000
  AND di.status = 'available'
ORDER BY di.asking_price;
*/

-- Track recent price changes
/*
SELECT v.vin, generate_vehicle_display_name(v.year, v.make, v.model, v.trim) as name,
       ph.old_price, ph.new_price, 
       (ph.new_price - ph.old_price) as price_change,
       ph.changed_at
FROM vehicle_price_history ph
JOIN dealership_inventory di ON ph.inventory_id = di.inventory_id
JOIN vehicles v ON di.vehicle_id = v.vehicle_id
WHERE ph.changed_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ph.changed_at DESC;
*/

-- ============================================================================
-- SCHEMA MIGRATION NOTES
-- ============================================================================

-- This refactored schema provides:
-- 1. Better naming conventions (snake_case, descriptive names)
-- 2. Proper data types and constraints
-- 3. Core business logic focused on dealership inventory management
-- 4. Auction data integration capabilities
-- 5. Subscription and user management
-- 6. Performance optimizations with indexes
-- 7. Useful views for common business queries
-- 8. Automatic timestamp updates via triggers
-- 9. Price change tracking
-- 10. Data scraping job management

-- To migrate from the old schema:
-- 1. Create new tables with this schema
-- 2. Copy data from old tables with appropriate column mapping
-- 3. Update application code to use new table and column names
-- 4. Test thoroughly before dropping old tables