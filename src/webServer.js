#!/usr/bin/env node

/**
 * Web Server for vAuto Vehicle Enrichment Bot
 * Main entry point when starting via npm start
 */

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const { loadJSON, saveJSON } = require("./utils");
require("dotenv").config();

class WebServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.runningJobs = new Map();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, "../public")));
  }

  setupRoutes() {
    // Serve the main web interface
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "../public/index.html"));
    });

    // API Routes
    this.app.get("/api/status", (req, res) => {
      const vehicles = loadJSON("./data/vehicles.json");
      const runningJobs = Array.from(this.runningJobs.keys());

      res.json({
        vehicleCount: vehicles.length,
        runningJobs,
        hasData: vehicles.length > 0,
      });
    });

    this.app.get("/api/vehicles", (req, res) => {
      const vehicles = loadJSON("./data/vehicles.json");
      res.json(vehicles);
    });

    this.app.get("/api/vehicles/export", (req, res) => {
      const vehicles = loadJSON("./data/vehicles.json");
      const filename = `vehicles_export_${
        new Date().toISOString().split("T")[0]
      }.json`;

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(JSON.stringify(vehicles, null, 2));
    });

    this.app.post("/api/scrape/carmax", async (req, res) => {
      const { mode } = req.body; // 'auctions' or 'mylist'

      if (this.runningJobs.has("carmax")) {
        return res
          .status(400)
          .json({ error: "CarMax scraping already in progress" });
      }

      const jobId = `carmax_${Date.now()}`;
      this.runningJobs.set("carmax", jobId);

      res.json({ jobId, message: `Starting CarMax scraping in ${mode} mode` });

      // Start the scraping process
      this.startCarMaxScraping(mode, jobId);
    });

    this.app.post("/api/scrape/vauto", async (req, res) => {
      if (this.runningJobs.has("vauto")) {
        return res
          .status(400)
          .json({ error: "vAuto enrichment already in progress" });
      }

      const vehicles = loadJSON("./data/vehicles.json");
      if (vehicles.length === 0) {
        return res.status(400).json({
          error: "No vehicles found. Please scrape CarMax data first.",
        });
      }

      const jobId = `vauto_${Date.now()}`;
      this.runningJobs.set("vauto", jobId);

      res.json({ jobId, message: "Starting vAuto enrichment" });

      // Start the vAuto enrichment
      this.startVAutoEnrichment(jobId);
    });

    this.app.post("/api/scrape/complete", async (req, res) => {
      if (this.runningJobs.has("complete")) {
        return res
          .status(400)
          .json({ error: "Complete workflow already in progress" });
      }

      const { mode } = req.body; // 'auctions' or 'mylist'
      const jobId = `complete_${Date.now()}`;
      this.runningJobs.set("complete", jobId);

      res.json({
        jobId,
        message: `Starting complete workflow in ${mode} mode`,
      });

      // Start the complete workflow
      this.startCompleteWorkflow(mode, jobId);
    });

    this.app.post("/api/cancel/:jobType", (req, res) => {
      const { jobType } = req.params;

      if (this.runningJobs.has(jobType)) {
        this.runningJobs.delete(jobType);
        this.io.emit("jobCancelled", { jobType });
        res.json({ message: `${jobType} job cancelled` });
      } else {
        res.status(404).json({ error: "Job not found" });
      }
    });
  }

  setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log("Client connected to web interface");

      // Send current status
      const vehicles = loadJSON("./data/vehicles.json");
      socket.emit("status", {
        vehicleCount: vehicles.length,
        runningJobs: Array.from(this.runningJobs.keys()),
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected from web interface");
      });
    });
  }

  async startCarMaxScraping(mode, jobId) {
    try {
      this.io.emit("jobStarted", { type: "carmax", mode, jobId });

      // Override console.log to emit to websocket
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(" ");
        this.io.emit("progress", { type: "carmax", message });
        originalLog(...args);
      };

      // Start scraping based on mode
      if (mode === "mylist") {
        await this.scrapeMyList();
      } else {
        const scraper = require("./carmaxScraper");
        await scraper.scrapeAuctions();
      }

      // Restore console.log
      console.log = originalLog;

      this.runningJobs.delete("carmax");
      this.io.emit("jobCompleted", { type: "carmax", jobId });
    } catch (error) {
      console.error("CarMax scraping error:", error);
      this.runningJobs.delete("carmax");
      this.io.emit("jobError", { type: "carmax", error: error.message });
    }
  }

  async startVAutoEnrichment(jobId) {
    try {
      this.io.emit("jobStarted", { type: "vauto", jobId });

      // Import the vAuto enricher
      const enricher = require("./carmaxVautoScraper");

      // Override console.log to emit to websocket
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(" ");
        this.io.emit("progress", { type: "vauto", message });
        originalLog(...args);
      };

      await enricher();

      // Restore console.log
      console.log = originalLog;

      this.runningJobs.delete("vauto");
      this.io.emit("jobCompleted", { type: "vauto", jobId });
    } catch (error) {
      console.error("vAuto enrichment error:", error);
      this.runningJobs.delete("vauto");
      this.io.emit("jobError", { type: "vauto", error: error.message });
    }
  }

  async startCompleteWorkflow(mode, jobId) {
    try {
      this.io.emit("jobStarted", { type: "complete", mode, jobId });

      // First run CarMax scraping
      await this.startCarMaxScrapingInternal(mode);

      // Then run vAuto enrichment
      await this.startVAutoEnrichmentInternal();

      this.runningJobs.delete("complete");
      this.io.emit("jobCompleted", { type: "complete", jobId });
    } catch (error) {
      console.error("Complete workflow error:", error);
      this.runningJobs.delete("complete");
      this.io.emit("jobError", { type: "complete", error: error.message });
    }
  }

  async startCarMaxScrapingInternal(mode) {
    if (mode === "mylist") {
      await this.scrapeMyList();
    } else {
      const scraper = require("./carmaxScraper");
      await scraper.scrapeAuctions();
    }
  }

  async startVAutoEnrichmentInternal() {
    const enricher = require("./carmaxVautoScraper");
    await enricher();
  }

  async scrapeMyList() {
    // Import and use the My List scraper
    const { scrapeMyList } = require("./carmaxScraper");
    this.io.emit("progress", {
      type: "carmax",
      message: "🔍 Navigating to CarMax My List...",
    });
    return await scrapeMyList();
  }

  start(port = 3000) {
    this.server.listen(port, () => {
      console.log(`🌐 Web interface available at http://localhost:${port}`);
    });
  }
}

// If called directly, start the server
if (require.main === module) {
  const server = new WebServer();
  server.start(3000);
}

module.exports = WebServer;
