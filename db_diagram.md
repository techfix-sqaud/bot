# Database Schema Diagram - Vehicle Auction Management System

## Entity Relationship Diagram

```mermaid
erDiagram
    %% Core User Management
    users {
        int userid PK
        varchar firstName
        varchar lastName
        varchar email UK
        timestamptz lastLogin
        varchar passwordhash
        bigint validationCode
        timestamptz validationCodeGeneratedAt
        timestamptz sessions
        varchar token
        user_role role
        timestamp createdat
    }

    %% Dealership Management
    dealerships {
        int dealershipid PK
        varchar name
        varchar EIN
        varchar streetAddress
        varchar city
        varchar zipCode
        varchar stateOrStateAbbreviation
        varchar phonenumber
        int createdby FK
        timestamp createdat
    }

    dealership_credentials {
        int credentialid PK
        varchar email UK
        varchar url
        varchar passwordhash
        int createdby FK
        int dealershipid FK
        timestamp createdat
    }

    %% Auction Management
    auction_events {
        int auction_id PK
        varchar auction_name
        varchar location
        timestamptz start_date
        timestamptz end_date
        auction_status status
        int total_vehicles
        timestamp created_at
    }

    %% Vehicle Information (Legacy)
    carsinformation {
        int carid PK
        varchar vin UK
        varchar make
        varchar model
        int year
        varchar trim
        varchar color
        varchar mileage_raw
        int mileage_numeric
        varchar ymmt
        varchar run_number
        varchar auction_location
        int auction_index
        timestamptz scraped_at
        timestamp created_at
    }

    %% Enhanced Vehicle Table
    vehicles {
        int vehicle_id PK
        varchar vin UK
        varchar make
        varchar model
        int year
        varchar trim
        varchar color
        varchar mileage_raw
        int mileage_numeric
        vehicle_condition condition
        jsonb features
        varchar run_number
        int auction_id FK
        int auction_index
        decimal estimated_value
        decimal reserve_price
        varchar ymmt "GENERATED"
        timestamptz scraped_at
        jsonb raw_data
        timestamp created_at
        timestamp updated_at
    }

    %% Bidding System
    user_bids {
        int bid_id PK
        int user_id FK
        int vehicle_id FK
        int auction_id FK
        decimal bid_amount
        bid_type bid_type
        bid_status bid_status
        decimal max_bid
        timestamptz bid_placed_at
        timestamptz bid_updated_at
        inet ip_address
        text user_agent
    }

    auction_results {
        int result_id PK
        int vehicle_id FK
        int auction_id FK
        int winning_user_id FK
        int winning_bid_id FK
        decimal final_price
        boolean reserve_met
        int total_bids
        int unique_bidders
        decimal starting_bid
        decimal bid_increment
        timestamptz auction_started_at
        timestamptz auction_ended_at
        timestamptz last_bid_at
        date payment_due_date
        timestamptz payment_received_at
        decimal amount_paid
        decimal fees_charged
        timestamptz created_at
    }

    %% Payment System
    user_payments {
        int payment_id PK
        int user_id FK
        int auction_result_id FK
        int vehicle_id FK
        decimal payment_amount
        decimal fees_amount
        decimal total_amount "GENERATED"
        payment_method payment_method
        varchar payment_status
        varchar transaction_reference
        date payment_date
        timestamptz processed_at
        timestamptz created_at
    }

    %% Dealership Inventory
    dealership_inventory {
        int inventory_id PK
        int dealership_id FK
        int vehicle_id FK
        decimal asking_price
        decimal cost_basis
        date date_acquired
        date date_listed
        date date_sold
        int days_in_inventory "GENERATED"
        varchar status
        text notes
        timestamp created_at
        timestamp updated_at
    }

    %% Scraping Management
    scraping_jobs {
        int job_id PK
        varchar job_name
        varchar source
        scraping_status status
        timestamptz started_at
        timestamptz completed_at
        int total_records
        int successful_records
        int failed_records
        text error_log
        int created_by FK
        timestamp created_at
    }

    vehicle_scraping_results {
        int result_id PK
        int job_id FK
        int vehicle_id FK
        varchar vin
        scraping_status scraping_status
        jsonb raw_data
        text error_message
        timestamptz scraped_at
    }

    %% Subscription Management
    subscriptionplans {
        int planid PK
        varchar planname
        decimal price
        int durationmonths
        text features
    }

    dealershipsubscribers {
        int subscriptionid PK
        int dealershipid FK
        int planid FK
        date startdate
        date enddate
        subscription_status status
    }

    paymentsinformation {
        int paymentid PK
        int subscriptionid FK
        decimal amount
        date paymentdate
        payment_method paymentmethod
        varchar transactionid UK
    }

    %% Additional Tables
    vehicle_images {
        int image_id PK
        int vehicle_id FK
        varchar image_url
        varchar image_type
        boolean is_primary
        timestamp uploaded_at
    }

    auction_locations {
        int location_id PK
        varchar location_name
        varchar city
        varchar state
        timestamp created_at
    }

    vehicle_history {
        int history_id PK
        int carid FK
        varchar field_changed
        text old_value
        text new_value
        timestamptz changed_at
        int changed_by FK
    }

    vehicles_archived {
        int vehicle_id
        varchar vin
        varchar make
        varchar model
        int year
        varchar trim
        timestamptz auction_ended_at
        timestamptz archived_at
        jsonb original_data
    }

    %% Relationships
    users ||--o{ dealerships : creates
    users ||--o{ dealership_credentials : creates
    users ||--o{ scraping_jobs : creates
    users ||--o{ user_bids : places
    users ||--o{ user_payments : makes
    users ||--o{ vehicle_history : changes

    dealerships ||--o{ dealership_credentials : has
    dealerships ||--o{ dealership_inventory : owns
    dealerships ||--o{ dealershipsubscribers : subscribes

    auction_events ||--o{ vehicles : contains
    auction_events ||--o{ user_bids : receives
    auction_events ||--o{ auction_results : generates

    vehicles ||--o{ user_bids : receives_bids
    vehicles ||--o{ auction_results : has_result
    vehicles ||--o{ dealership_inventory : listed_in
    vehicles ||--o{ vehicle_scraping_results : scraped_as
    vehicles ||--o{ vehicle_images : has_images
    vehicles ||--o{ user_payments : paid_for

    user_bids ||--o| auction_results : wins
    auction_results ||--o{ user_payments : requires

    scraping_jobs ||--o{ vehicle_scraping_results : produces

    subscriptionplans ||--o{ dealershipsubscribers : defines
    dealershipsubscribers ||--o{ paymentsinformation : generates

    carsinformation ||--o{ vehicle_history : tracked_in
```

## Table Partitioning Strategy

```mermaid
graph TD
    A[user_bids] --> B[user_bids_2025_06]
    A --> C[user_bids_2025_07]
    A --> D[user_bids_2025_08]
    A --> E[user_bids_YYYY_MM...]

    F[auction_results] --> G[auction_results_2025_q2]
    F --> H[auction_results_2025_q3]
    F --> I[auction_results_2025_q4]
    F --> J[auction_results_YYYY_qN...]

    K[user_payments] --> L[user_payments_2025_06]
    K --> M[user_payments_2025_07]
    K --> N[user_payments_2025_08]
    K --> O[user_payments_YYYY_MM...]

    P[vehicles_archived] --> Q[vehicles_archived_2024]
    P --> R[vehicles_archived_2025]
    P --> S[vehicles_archived_YYYY...]
```

## Key Features

### 1. **Bidding System**
- Track all user bids with timestamps
- Support for different bid types (manual, auto, proxy)
- Real-time bid status tracking

### 2. **Auction Management**
- Complete auction lifecycle tracking
- Vehicle-to-auction relationships
- Final results and payment tracking

### 3. **Payment Processing**
- Detailed payment records
- Fee calculation and tracking
- Multiple payment methods support

### 4. **Data Partitioning**
- Monthly partitions for high-volume tables
- Quarterly partitions for analytical data
- Automated archive management

### 5. **Scalability Features**
- JSONB for flexible vehicle data
- Comprehensive indexing strategy
- Full-text search capabilities
- Automated partition management

## ENUM Types Used

```sql
-- User and system roles
CREATE TYPE user_role AS ENUM ('superAdmin', 'Admin', 'dealer');
CREATE TYPE user_status AS ENUM ('active', 'not active', 'revoked');

-- Auction and bidding
CREATE TYPE auction_status AS ENUM ('live', 'upcoming', 'completed', 'cancelled');
CREATE TYPE bid_type AS ENUM ('manual', 'auto', 'proxy', 'reserve');
CREATE TYPE bid_status AS ENUM ('active', 'outbid', 'winning', 'lost', 'withdrawn');

-- Vehicle condition
CREATE TYPE vehicle_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'salvage');

-- System operations
CREATE TYPE scraping_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled');
CREATE TYPE payment_method AS ENUM ('card', 'paypal', 'checking');
```

This database design provides a comprehensive solution for managing vehicle auctions with proper data lifecycle management, detailed bidding tracking, and scalable architecture.
