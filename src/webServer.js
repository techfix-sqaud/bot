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
const session = require("express-session");
const { loadJSON, saveJSON } = require("./utils");
const auth = require("./auth");
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

    // Error handling (must be after all routes)
    this.app.use((err, req, res, next) => {
      console.error("Error:", err);
      res.status(500).render("error", {
        details: process.env.NODE_ENV === "development" ? err.message : null,
      });
    });

    // 404 handler (must be last)
    this.app.use((req, res) => {
      res.status(404).render("error", {
        details: `Page not found: ${req.path}`,
      });
    });
  }

  setupMiddleware() {
    // Set EJS as template engine
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(__dirname, "../views"));

    // Session middleware
    this.app.use(
      session({
        secret:
          process.env.SESSION_SECRET ||
          "your-session-secret-change-in-production",
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: false, // Set to true in production with HTTPS
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
      })
    );

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, "../public")));
  }

  setupRoutes() {
    // Authentication routes
    this.setupAuthRoutes();

    // Protected dashboard route
    this.app.get("/", async (req, res) => {
      // const user = await auth.getUserById(req.user.id);
      res.render("dashboard");
    });

    // Admin dashboard (public or add auth as needed)
    this.app.get("/admin", (req, res) => {
      console.log("Rendering admin dashboard");
      res.render("admin");
    });

    // API Routes - all protected
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
      if (this.runningJobs.has("carmax")) {
        return res
          .status(400)
          .json({ error: "CarMax My List scraping already in progress" });
      }

      const jobId = `carmax_${Date.now()}`;
      this.runningJobs.set("carmax", jobId);

      res.json({ jobId, message: "Starting CarMax My List scraping" });

      // Start the scraping process
      this.startCarMaxScraping(jobId);
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

      // Start the vAuto enrichment with user credentials
      this.startVAutoEnrichment(jobId);
    });

    this.app.post("/api/scrape/complete", async (req, res) => {
      if (this.runningJobs.has("complete")) {
        return res
          .status(400)
          .json({ error: "Complete workflow already in progress" });
      }

      const jobId = `complete_${Date.now()}`;
      this.runningJobs.set("complete", jobId);

      res.json({
        jobId,
        message: "Starting complete workflow (My List + vAuto enrichment)",
      });

      // Start the complete workflow
      this.startCompleteWorkflow(jobId);
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

  setupAuthRoutes() {
    // Login page
    this.app.get("/login", (req, res) => {
      if (req.session && req.session.user) {
        return res.redirect("/");
      }
      res.render("login", {
        error: null,
        success: null,
        email: "",
      });
    });

    // Signup page
    this.app.get("/signup", (req, res) => {
      if (req.session && req.session.user) {
        return res.redirect("/");
      }
      res.render("signup", {
        error: null,
        formData: {},
      });
    });

    // ...existing code...

    // Login POST
    this.app.post("/auth/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await auth.login(email, password);

        req.session.user = user;
        res.redirect("/");
      } catch (error) {
        res.render("login", {
          error: error.message,
          success: null,
          email: req.body.email || "",
        });
      }
    });

    // Signup POST
    this.app.post("/auth/signup", async (req, res) => {
      try {
        const {
          email,
          password,
          confirmPassword,
          carmaxEmail,
          carmaxPassword,
          vautoUsername,
          vautoPassword,
          vautoSecretKey,
        } = req.body;

        // Validate passwords match
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        // Validate required fields
        if (
          !email ||
          !password ||
          !carmaxEmail ||
          !carmaxPassword ||
          !vautoUsername ||
          !vautoPassword ||
          !vautoSecretKey
        ) {
          throw new Error("All fields are required");
        }

        const user = await auth.register({
          email,
          password,
          carmaxEmail,
          carmaxPassword,
          vautoUsername,
          vautoPassword,
          vautoSecretKey,
        });

        res.render("login", {
          error: null,
          success: "Account created successfully! Please login.",
          email: email,
        });
      } catch (error) {
        res.render("signup", {
          error: error.message,
          formData: req.body,
        });
      }
    });

    // Logout
    this.app.get("/auth/logout", (req, res) => {
      req.session.destroy();
      res.redirect("/login");
    });

    // ...existing code...
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

  async startCarMaxScraping(jobId) {
    try {
      this.io.emit("jobStarted", { type: "carmax", jobId });

      // Override console.log to emit to websocket
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(" ");
        this.io.emit("progress", { type: "carmax", message });
        originalLog(...args);
      };

      // Use the new clean scraper
      const { scrapeMyList } = require("./scrapers/carmax-mylist-scraper");
      await scrapeMyList(jobId);

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

      // Override console.log to emit to websocket
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(" ");
        this.io.emit("progress", { type: "vauto", message });
        originalLog(...args);
      };

      // Use the new clean enrichment service
      const {
        enrichVehiclesWithVAuto,
      } = require("./services/vauto-enrichment");
      await enrichVehiclesWithVAuto(jobId);

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

  async startCompleteWorkflow(jobId) {
    try {
      this.io.emit("jobStarted", { type: "complete", jobId });

      // Override console.log to emit to websocket
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.join(" ");
        this.io.emit("progress", { type: "complete", message });
        originalLog(...args);
      };

      // Use the new clean workflow service
      const { runCompleteWorkflow } = require("./services/workflow");
      await runCompleteWorkflow(jobId);

      // Restore console.log
      console.log = originalLog;

      this.runningJobs.delete("complete");
      this.io.emit("jobCompleted", { type: "complete", jobId });
    } catch (error) {
      console.error("Complete workflow error:", error);
      this.runningJobs.delete("complete");
      this.io.emit("jobError", { type: "complete", error: error.message });
    }
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
