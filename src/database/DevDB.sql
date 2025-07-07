-- =============================================
-- VEHICLES TABLE (Refactored)
-- =============================================

-- Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUM Types
CREATE TYPE auction_status AS ENUM ('upcoming', 'active', 'completed', 'cancelled');
CREATE TYPE vehicle_source AS ENUM ('carmax', 'api', 'manual');

-- Refactored VEHICLES table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Core Vehicle Identifiers
    vehicle_vin VARCHAR(17) NOT NULL UNIQUE,
    auction_item_id VARCHAR(100), -- CarMax auction item ID

    -- Vehicle Basic Info
    vehicle_name VARCHAR(255) NOT NULL,
    mileage INTEGER NOT NULL CHECK (mileage >= 0),
    run_number VARCHAR(50),

    -- Auction Details
    auction_start_date TIMESTAMP WITH TIME ZONE,
    auction_end_date TIMESTAMP WITH TIME ZONE,
    auction_status auction_status DEFAULT 'upcoming',
    CHECK (
        auction_end_date IS NULL OR auction_end_date > auction_start_date
    ),

    -- Optional FK to auction_sessions (if linked to a specific session)
    session_id UUID REFERENCES auction_sessions(id) ON DELETE SET NULL,

    -- Notes and Evaluation
    notes TEXT DEFAULT '',
    has_notes BOOLEAN DEFAULT FALSE,
    auto_generated_note BOOLEAN DEFAULT FALSE,

    -- Evaluation Data
    vauto_evaluation JSONB, -- NULL if not available
    kbb_value DECIMAL(10,2),
    mmr_value DECIMAL(10,2),
    accident_damage TEXT,
    owner_info TEXT,
    owner_date_text TEXT,
    last_evaluation_date TIMESTAMP WITH TIME ZONE,

    -- Processing Status
    processed_by_bot BOOLEAN DEFAULT FALSE,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    needs_reprocessing BOOLEAN DEFAULT FALSE,

    -- Raw Platform Data
    carmax_data JSONB, -- NULL if not pulled yet

    -- Error Logs
    processing_errors JSONB DEFAULT '[]',

    -- Metadata
    source vehicle_source DEFAULT 'carmax',

    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', vehicle_name)
    ) STORED,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES FOR VEHICLES TABLE
-- =============================================

-- Text search optimization
CREATE INDEX idx_vehicles_name_gin ON vehicles USING gin(vehicle_name gin_trgm_ops);
CREATE INDEX idx_vehicles_search_vector ON vehicles USING gin(search_vector);

-- General Indexes
CREATE INDEX idx_vehicles_vin ON vehicles(vehicle_vin);
CREATE INDEX idx_vehicles_auction_item_id ON vehicles(auction_item_id) WHERE auction_item_id IS NOT NULL;
CREATE INDEX idx_vehicles_auction_date_status ON vehicles(auction_start_date, auction_status);
CREATE INDEX idx_vehicles_processing_status ON vehicles(has_notes, processed_by_bot);
CREATE INDEX idx_vehicles_needs_reprocessing ON vehicles(needs_reprocessing, last_processed_at) WHERE needs_reprocessing = TRUE;
CREATE INDEX idx_vehicles_source ON vehicles(source);
CREATE INDEX idx_vehicles_created_at ON vehicles(created_at DESC);
CREATE INDEX idx_vehicles_session_id ON vehicles(session_id);

-- JSON indexes
CREATE INDEX idx_vehicles_vauto_kbb ON vehicles USING gin((vauto_evaluation->'kbb'));
CREATE INDEX idx_vehicles_carmax_data ON vehicles USING gin(carmax_data);

-- Partial index for unprocessed vehicles
CREATE INDEX idx_vehicles_unprocessed ON vehicles(vehicle_vin) WHERE processed_by_bot = FALSE;

-- =============================================
-- TIMESTAMP TRIGGER FOR VEHICLES
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_vehicles_updated_at
BEFORE UPDATE ON vehicles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VEHICLES VIEW FOR UNPROCESSED VEHICLES
-- =============================================

CREATE VIEW vehicles_needing_notes AS
SELECT 
    id, vehicle_vin, vehicle_name, mileage, auction_start_date,
    carmax_data, created_at
FROM vehicles
WHERE has_notes = FALSE 
    AND processed_by_bot = FALSE
    AND jsonb_array_length(processing_errors) < 3;

-- =============================================
-- VEHICLE UTILITIES FUNCTIONS
-- =============================================

-- Function to fetch vehicles needing reprocessing
CREATE OR REPLACE FUNCTION get_vehicles_for_reprocessing()
RETURNS TABLE (
    vehicle_id UUID,
    vehicle_vin VARCHAR(17),
    vehicle_name VARCHAR(255),
    last_processed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT v.id, v.vehicle_vin, v.vehicle_name, v.last_processed_at
    FROM vehicles v
    WHERE v.needs_reprocessing = TRUE
        AND (v.last_processed_at IS NULL 
             OR v.last_processed_at < CURRENT_TIMESTAMP - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql;

-- Function to mark a vehicle as processed
CREATE OR REPLACE FUNCTION mark_vehicle_processed(vehicle_vin_input VARCHAR(17))
RETURNS VOID AS $$
BEGIN
    UPDATE vehicles 
    SET processed_by_bot = TRUE,
        last_processed_at = CURRENT_TIMESTAMP,
        needs_reprocessing = FALSE,
        updated_at = CURRENT_TIMESTAMP
    WHERE vehicle_vin = vehicle_vin_input;
END;
$$ LANGUAGE plpgsql;
