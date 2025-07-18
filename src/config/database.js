// PostgreSQL Database Configuration and Connection
// Using pg (node-postgres) driver with connection pooling

const { Pool } = require("pg");
require("dotenv").config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "db-dev.valstine.com",
  database: process.env.DB_NAME || "RduBotDEV",
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,

  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
};

const pool = new Pool(dbConfig);

pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client:", err);
  process.exit(-1);
});

pool.on("connect", (client) => {
  console.log("New client connected to PostgreSQL");
});

class DatabaseConnection {
  constructor() {
    this.pool = pool;
  }

  async getClient() {
    return await this.pool.connect();
  }

  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (process.env.NODE_ENV === "development") {
        console.log("Executed query:", {
          text,
          duration,
          rows: result.rowCount,
        });
      }

      return result;
    } catch (error) {
      console.error("Database query error:", {
        text,
        params,
        error: error.message,
      });
      throw error;
    }
  }
  async transaction(callback) {
    const client = await this.getClient();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.query(
        "SELECT NOW() as timestamp, version() as version"
      );
      return {
        status: "healthy",
        timestamp: result.rows[0].timestamp,
        version: result.rows[0].version,
        poolSize: this.pool.totalCount,
        idleClients: this.pool.idleCount,
        waitingClients: this.pool.waitingCount,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  // Initialize database (run migrations, etc.)
  async initialize() {
    try {
      // Test connection
      await this.query("SELECT 1");
      console.log("✅ Database connection established");

      // Check if tables exist
      const tableCheck = await this.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('vehicles', 'auction_sessions', 'bot_configurations', 'error_logs')
      `);

      if (tableCheck.rows.length === 0) {
        console.log(
          "⚠️  Database tables not found. Please run the schema.sql file to create tables."
        );
      } else {
        console.log(`✅ Found ${tableCheck.rows.length} database tables`);
      }

      return true;
    } catch (error) {
      console.error("❌ Database initialization failed:", error.message);
      throw error;
    }
  }

  // Graceful shutdown
  async close() {
    try {
      await this.pool.end();
      console.log("Database pool closed");
    } catch (error) {
      console.error("Error closing database pool:", error);
    }
  }
}

// Singleton instance
const db = new DatabaseConnection();

// Export the database instance and pool
module.exports = {
  db,
  pool,
  query: db.query.bind(db),
  transaction: db.transaction.bind(db),
  healthCheck: db.healthCheck.bind(db),
  initialize: db.initialize.bind(db),
  close: db.close.bind(db),
};

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("Received SIGINT, closing database connection...");
  await db.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, closing database connection...");
  await db.close();
  process.exit(0);
});
