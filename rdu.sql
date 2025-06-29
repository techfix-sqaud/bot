-- Create ENUM types
CREATE TYPE user_role AS ENUM ('superAdmin', 'Admin', 'dealer');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled');
CREATE TYPE user_status AS ENUM ('active', 'not active', 'revoked');
CREATE TYPE payment_method AS ENUM ('card', 'paypal', 'checking');
CREATE TYPE auction_status AS ENUM ('live', 'upcoming', 'completed', 'cancelled');
CREATE TYPE vehicle_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'salvage');
CREATE TYPE scraping_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
CREATE TYPE bid_type AS ENUM ('manual', 'auto', 'proxy', 'reserve');
CREATE TYPE bid_status AS ENUM ('active', 'outbid', 'winning', 'lost', 'withdrawn');

-- Users Table
CREATE TABLE users (
    userid SERIAL PRIMARY KEY,
	firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
	lastLogin TIMESTAMPZ,
    passwordhash VARCHAR(255) NOT NULL,
	validationCode BIGINT,
	validationCodeGenaratedAt TIMESTAMPZ,
	sessions TIMESTAMPZ,
	token VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'dealer',
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dealerships Table
CREATE TABLE dealerships (
    dealershipid SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
	EIN VARCHAR (12) NOT NULL,
    streetAddress VARCHAR(255),
	city VARCHAR(100) NOT NULL,
	zipCode VARCHAR(25) NOT NULL,
	stateOrStateAbbereviation VARCHAR(100) NOT NULL,
    phonenumber VARCHAR(20),
    createdby INT REFERENCES users(userid),
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dealership Credentials Table (Fixed table name)
CREATE TABLE dealership_credentials (
    credentialid SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
	url VARCHAR(255) NOT NULL,
   	passwordhash VARCHAR(255) NOT NULL,
    createdby INT REFERENCES users(userid),
	dealershipid INT REFERENCES dealerships(dealershipid),
    createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cars Information Table (Enhanced to handle auction data)
CREATE TABLE carsinformation (
    carid SERIAL PRIMARY KEY,
    vin VARCHAR(17) UNIQUE NOT NULL,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INT CHECK (year >= 1886),
    trim VARCHAR(100),
    color VARCHAR(30),
    mileage_raw VARCHAR(50), -- Store original mileage string like "139,349 mi"
    mileage_numeric INT, -- Extracted numeric value for calculations
    ymmt VARCHAR(200), -- Year Make Model Trim combined
    run_number VARCHAR(100), -- Auction run number like "A/1 • Louisville"
    auction_location VARCHAR(200), -- Location like "Louisville, KY"
    auction_index INT, -- Auction index number
    scraped_at TIMESTAMPTZ, -- When this data was scraped
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auction Events Table (Track individual auction events)
CREATE TABLE auction_events (
    auction_id SERIAL PRIMARY KEY,
    auction_name VARCHAR(200) NOT NULL,
    location VARCHAR(200) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    status auction_status DEFAULT 'upcoming',
    total_vehicles INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Vehicle Table with JSON support for flexible data
CREATE TABLE vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    vin VARCHAR(17) UNIQUE NOT NULL,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INT CHECK (year >= 1886 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 2),
    trim VARCHAR(100),
    color VARCHAR(50),
    
    -- Mileage handling
    mileage_raw VARCHAR(50),
    mileage_numeric INT,
    
    -- Condition and features
    condition vehicle_condition,
    features JSONB, -- Store flexible vehicle features
    
    -- Auction specific data
    run_number VARCHAR(100),
    auction_id INT REFERENCES auction_events(auction_id),
    auction_index INT,
    estimated_value DECIMAL(12, 2),
    reserve_price DECIMAL(12, 2),
    
    -- Metadata
    ymmt VARCHAR(200) GENERATED ALWAYS AS (year || ' ' || make || ' ' || model || COALESCE(' ' || trim, '')) STORED,
    scraped_at TIMESTAMPTZ,
    raw_data JSONB, -- Store original scraped JSON data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scraping Jobs Table (Track scraping operations)
CREATE TABLE scraping_jobs (
    job_id SERIAL PRIMARY KEY,
    job_name VARCHAR(200) NOT NULL,
    source VARCHAR(100) NOT NULL, -- 'carmax', 'vauto', etc.
    status scraping_status DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_records INT DEFAULT 0,
    successful_records INT DEFAULT 0,
    failed_records INT DEFAULT 0,
    error_log TEXT,
    created_by INT REFERENCES users(userid),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle Scraping Results (Link vehicles to scraping jobs)
CREATE TABLE vehicle_scraping_results (
    result_id SERIAL PRIMARY KEY,
    job_id INT NOT NULL REFERENCES scraping_jobs(job_id),
    vehicle_id INT REFERENCES vehicles(vehicle_id),
    vin VARCHAR(17) NOT NULL,
    scraping_status scraping_status DEFAULT 'pending',
    raw_data JSONB,
    error_message TEXT,
    scraped_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Dealership Inventory (Enhanced)
CREATE TABLE dealership_inventory (
    inventory_id SERIAL PRIMARY KEY,
    dealership_id INT NOT NULL REFERENCES dealerships(dealershipid),
    vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id),
    
    -- Pricing and status
    asking_price DECIMAL(12, 2),
    cost_basis DECIMAL(12, 2),
    date_acquired DATE,
    date_listed DATE,
    date_sold DATE,
    days_in_inventory INT GENERATED ALWAYS AS (
        CASE 
            WHEN date_sold IS NOT NULL THEN date_sold - date_acquired
            ELSE CURRENT_DATE - date_acquired
        END
    ) STORED,
    
    -- Inventory status
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'sold', 'reserved', 'pending')),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments Information Table
CREATE TABLE paymentsinformation (
    paymentid SERIAL PRIMARY KEY,
    subscriptionid INT NOT NULL REFERENCES dealershipsubscribers(subscriptionid),
    amount DECIMAL(10, 2) NOT NULL,
    paymentdate DATE NOT NULL,
    paymentmethod payment_method NOT NULL,
    transactionid VARCHAR(100) UNIQUE
);

-- Vehicle Images Table
CREATE TABLE vehicle_images (
    image_id SERIAL PRIMARY KEY,
    vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id),
    image_url VARCHAR(500) NOT NULL,
    image_type VARCHAR(50), -- 'exterior', 'interior', 'engine', 'damage'
    is_primary BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bidding and Auction Activity Tables

-- User Bids Table - Track all bidding activity
CREATE TABLE user_bids (
    bid_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(userid),
    vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id),
    auction_id INT NOT NULL REFERENCES auction_events(auction_id),
    
    -- Bid details
    bid_amount DECIMAL(12, 2) NOT NULL,
    bid_type bid_type DEFAULT 'manual',
    bid_status bid_status DEFAULT 'active',
    max_bid DECIMAL(12, 2), -- For proxy bidding
    
    -- Timestamps
    bid_placed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    bid_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    
    CONSTRAINT valid_bid_amount CHECK (bid_amount > 0),
    CONSTRAINT valid_max_bid CHECK (max_bid IS NULL OR max_bid >= bid_amount)
) PARTITION BY RANGE (bid_placed_at);

-- Auction Results Table - Final outcomes
CREATE TABLE auction_results (
    result_id SERIAL PRIMARY KEY,
    vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id),
    auction_id INT NOT NULL REFERENCES auction_events(auction_id),
    
    -- Winner information
    winning_user_id INT REFERENCES users(userid),
    winning_bid_id INT REFERENCES user_bids(bid_id),
    final_price DECIMAL(12, 2),
    reserve_met BOOLEAN DEFAULT FALSE,
    
    -- Auction statistics
    total_bids INT DEFAULT 0,
    unique_bidders INT DEFAULT 0,
    starting_bid DECIMAL(12, 2),
    bid_increment DECIMAL(8, 2) DEFAULT 100.00,
    
    -- Timing
    auction_started_at TIMESTAMPTZ,
    auction_ended_at TIMESTAMPTZ,
    last_bid_at TIMESTAMPTZ,
    
    -- Payment and delivery
    payment_due_date DATE,
    payment_received_at TIMESTAMPTZ,
    amount_paid DECIMAL(12, 2),
    fees_charged DECIMAL(10, 2),
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (auction_ended_at);

-- User Payments Table - Track what users actually paid
CREATE TABLE user_payments (
    payment_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(userid),
    auction_result_id INT NOT NULL REFERENCES auction_results(result_id),
    vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id),
    
    -- Payment details
    payment_amount DECIMAL(12, 2) NOT NULL,
    fees_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) GENERATED ALWAYS AS (payment_amount + fees_amount) STORED,
    
    -- Payment method and status
    payment_method payment_method NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    transaction_reference VARCHAR(100),
    
    -- Timestamps
    payment_date DATE NOT NULL,
    processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (payment_date);

-- TABLE PARTITIONING SETUP FOR AUCTION DATA LIFECYCLE

-- Partition user_bids by month (auctions are time-sensitive)
CREATE TABLE user_bids_2025_06 PARTITION OF user_bids 
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE user_bids_2025_07 PARTITION OF user_bids 
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE user_bids_2025_08 PARTITION OF user_bids 
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
-- Add more partitions as needed

-- Partition auction_results by quarter (for historical analysis)
CREATE TABLE auction_results_2025_q2 PARTITION OF auction_results 
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE auction_results_2025_q3 PARTITION OF auction_results 
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');
CREATE TABLE auction_results_2025_q4 PARTITION OF auction_results 
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- Partition user_payments by month
CREATE TABLE user_payments_2025_06 PARTITION OF user_payments 
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE user_payments_2025_07 PARTITION OF user_payments 
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE user_payments_2025_08 PARTITION OF user_payments 
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

-- Archive old vehicles table with partitioning
CREATE TABLE vehicles_archived (
    vehicle_id INT,
    vin VARCHAR(17),
    make VARCHAR(50),
    model VARCHAR(50),
    year INT,
    trim VARCHAR(100),
    auction_ended_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    original_data JSONB
) PARTITION BY RANGE (archived_at);

-- Archive partitions by year
CREATE TABLE vehicles_archived_2024 PARTITION OF vehicles_archived 
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE vehicles_archived_2025 PARTITION OF vehicles_archived 
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- AUTOMATED PARTITION MANAGEMENT

-- Function to create monthly partitions automatically
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name TEXT,
    start_date DATE
) RETURNS VOID AS $$
DECLARE
    end_date DATE;
    partition_name TEXT;
BEGIN
    end_date := start_date + INTERVAL '1 month';
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        partition_name, table_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;

-- Function to archive old vehicles after auction ends
CREATE OR REPLACE FUNCTION archive_old_vehicles() RETURNS VOID AS $$
BEGIN
    -- Move vehicles from completed auctions older than 30 days to archive
    INSERT INTO vehicles_archived (
        vehicle_id, vin, make, model, year, trim, 
        auction_ended_at, original_data
    )
    SELECT 
        v.vehicle_id, v.vin, v.make, v.model, v.year, v.trim,
        ae.end_date, v.raw_data
    FROM vehicles v
    JOIN auction_events ae ON v.auction_id = ae.auction_id
    WHERE ae.status = 'completed' 
    AND ae.end_date < CURRENT_DATE - INTERVAL '30 days'
    AND NOT EXISTS (
        SELECT 1 FROM vehicles_archived va WHERE va.vehicle_id = v.vehicle_id
    );
    
    -- Remove archived vehicles from main table
    DELETE FROM vehicles v
    WHERE EXISTS (
        SELECT 1 FROM vehicles_archived va WHERE va.vehicle_id = v.vehicle_id
    );
END;
$$ LANGUAGE plpgsql;

-- Scheduled job setup (requires pg_cron extension)
-- SELECT cron.schedule('archive-vehicles', '0 2 * * *', 'SELECT archive_old_vehicles();');

-- Indexes for better performance
CREATE INDEX idx_carsinformation_vin ON carsinformation(vin);
CREATE INDEX idx_carsinformation_make_model ON carsinformation(make, model);
CREATE INDEX idx_carsinformation_year ON carsinformation(year);
CREATE INDEX idx_carsinformation_scraped_at ON carsinformation(scraped_at);
CREATE INDEX idx_carsinformation_auction_location ON carsinformation(auction_location);
CREATE INDEX idx_dealershipcars_dealership ON dealershipcars(dealershipid);
CREATE INDEX idx_dealershipcars_car ON dealershipcars(carid);

-- Performance Optimizations and Advanced Features

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ...existing helper functions continue...

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status ON user_bids(vehicle_id, bid_status);
CREATE INDEX idx_user_bids_auction ON user_bids(auction_id);
CREATE INDEX idx_user_bids_amount ON user_bids(bid_amount);

-- Indexes for auction_results table  
CREATE INDEX idx_auction_results_winner ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_vehicle ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_date ON auction_results(auction_ended_at);
CREATE INDEX idx_auction_results_price ON auction_results(final_price);

-- Indexes for user_payments table
CREATE INDEX idx_user_payments_user_date ON user_payments(user_id, payment_date);
CREATE INDEX idx_user_payments_status ON user_payments(payment_status);
CREATE INDEX idx_user_payments_amount ON user_payments(payment_amount);
CREATE INDEX idx_user_payments_vehicle ON user_payments(vehicle_id);

-- Composite indexes for common queries
CREATE INDEX idx_bids_user_vehicle_date ON user_bids(user_id, vehicle_id, bid_placed_at);
CREATE INDEX idx_payments_user_month ON user_payments(user_id, DATE_TRUNC('month', payment_date));

-- MAINTENANCE AND CLEANUP PROCEDURES

-- Function to clean up old partitions
CREATE OR REPLACE FUNCTION cleanup_old_partitions(
    table_base_name TEXT,
    retention_months INT DEFAULT 12
) RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_months || ' months')::INTERVAL;
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE table_base_name || '_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name and check if it's old enough
        IF (SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$')) IS NOT NULL THEN
            DECLARE
                partition_date DATE;
            BEGIN
                partition_date := TO_DATE(SUBSTRING(partition_record.tablename FROM '(\d{4}_\d{2})$'), 'YYYY_MM');
                IF partition_date < cutoff_date THEN
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(partition_record.tablename);
                    RAISE NOTICE 'Dropped old partition: %', partition_record.tablename;
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not process partition: %', partition_record.tablename;
            END;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create next month's partitions automatically
CREATE OR REPLACE FUNCTION create_next_month_partitions() RETURNS VOID AS $$
DECLARE
    next_month DATE;
BEGIN
    next_month := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    
    -- Create partitions for next month
    PERFORM create_monthly_partition('user_bids', next_month);
    PERFORM create_monthly_partition('user_payments', next_month);
    
    -- Create quarterly partition for auction_results if needed
    IF EXTRACT(MONTH FROM next_month) IN (1, 4, 7, 10) THEN
        DECLARE
            quarter_start DATE;
            quarter_end DATE;
            partition_name TEXT;
        BEGIN
            quarter_start := DATE_TRUNC('quarter', next_month);
            quarter_end := quarter_start + INTERVAL '3 months';
            partition_name := 'auction_results_' || to_char(quarter_start, 'YYYY_q') || EXTRACT(QUARTER FROM quarter_start);
            
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF auction_results FOR VALUES FROM (%L) TO (%L)',
                partition_name, quarter_start, quarter_end
            );
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Indexing Strategy
CREATE INDEX idx_vehicles_vin_hash ON vehicles USING hash(vin); -- For exact VIN lookups
CREATE INDEX idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX idx_vehicles_auction_id ON vehicles(auction_id);
CREATE INDEX idx_vehicles_scraped_at ON vehicles(scraped_at);
CREATE INDEX idx_vehicles_mileage_numeric ON vehicles(mileage_numeric);
CREATE INDEX idx_vehicles_estimated_value ON vehicles(estimated_value);

-- JSONB indexes for flexible queries
CREATE INDEX idx_vehicles_features_gin ON vehicles USING gin(features);
CREATE INDEX idx_vehicles_raw_data_gin ON vehicles USING gin(raw_data);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
    to_tsvector('english', make || ' ' || model || ' ' || COALESCE(trim, ''))
);

-- Inventory indexes
CREATE INDEX idx_inventory_dealership_status ON dealership_inventory(dealership_id, status);
CREATE INDEX idx_inventory_days ON dealership_inventory(days_in_inventory);

-- Bidding tables indexes
CREATE INDEX idx_user_bids_user_id ON user_bids(user_id);
CREATE INDEX idx_user_bids_vehicle_id ON user_bids(vehicle_id);
CREATE INDEX idx_user_bids_auction_id ON user_bids(auction_id);
CREATE INDEX idx_user_bids_bid_placed_at ON user_bids(bid_placed_at);

CREATE INDEX idx_auction_results_vehicle_id ON auction_results(vehicle_id);
CREATE INDEX idx_auction_results_auction_id ON auction_results(auction_id);
CREATE INDEX idx_auction_results_winning_user_id ON auction_results(winning_user_id);
CREATE INDEX idx_auction_results_auction_ended_at ON auction_results(auction_ended_at);

CREATE INDEX idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX idx_user_payments_auction_result_id ON user_payments(auction_result_id);
CREATE INDEX idx_user_payments_payment_date ON user_payments(payment_date);

-- ADDITIONAL INDEXES FOR BIDDING AND PAYMENT QUERIES

-- Indexes for user_bids table
CREATE INDEX idx_user_bids_user_date ON user_bids(user_id, bid_placed_at);
CREATE INDEX idx_user_bids_vehicle_status