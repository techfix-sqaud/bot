const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const VehicleDataOrchestrator = require("./orchestrator");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "../data");

app.use(express.json({ limit: "50mb" }));

// Health check endpoint for deployment monitoring
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    mode: process.env.MODE || "web",
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "development",
  });
});

// Enhanced file management
async function getAvailableFiles() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    const fileStats = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(DATA_DIR, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          isAnnotated: file.includes("annotated"),
        };
      })
    );

    return fileStats.sort((a, b) => b.modified - a.modified);
  } catch (error) {
    return [];
  }
}

// Get list of all data files
app.get("/api/files", async (req, res) => {
  try {
    const files = await getAvailableFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: "Failed to get file list" });
  }
});

// Download any file (with format conversion)
app.get("/api/download/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const { format = "json" } = req.query;

    const filePath = path.join(DATA_DIR, filename);

    if (format === "json") {
      const data = await fs.readFile(filePath, "utf8");
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(data);
    } else {
      // Use orchestrator to export in different format
      const orchestrator = new VehicleDataOrchestrator();
      const baseName = filename.replace(".json", "");
      const result = await orchestrator.exportExistingData(
        filePath,
        format,
        baseName
      );

      const exportData = await fs.readFile(result.exportFile);
      const exportFilename = path.basename(result.exportFile);

      // Set appropriate content type
      const contentTypes = {
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
        csv: "text/csv",
      };

      res.setHeader(
        "Content-Type",
        contentTypes[format] || "application/octet-stream"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportFilename}"`
      );
      res.send(exportData);
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to download file: " + error.message });
  }
});

// Get detailed stats for a file
app.get("/api/stats/:filename?", async (req, res) => {
  try {
    const { filename } = req.params;
    const files = await getAvailableFiles();

    if (!filename) {
      // Return stats for all files
      const totalStats = {
        totalFiles: files.length,
        latestFile: files[0]?.name || null,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
      };
      res.json({ files, totalStats });
    } else {
      // Return stats for specific file
      const filePath = path.join(DATA_DIR, filename);
      const data = await fs.readFile(filePath, "utf8");
      const vehicles = JSON.parse(data);
      const stats = await fs.stat(filePath);

      res.json({
        filename,
        totalVehicles: vehicles.length,
        fileSize: stats.size,
        lastModified: stats.mtime,
        hasVAutoData: vehicles.filter((v) => v.vautoEvaluation || v.vautoData)
          .length,
        sampleVehicle: vehicles[0] || null,
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats: " + error.message });
  }
});

// Run complete workflow
app.post("/api/workflow", async (req, res) => {
  try {
    const {
      skipScraping = false,
      exportFormat = "xlsx",
      vins = [],
      userEmail = "web-user@example.com",
    } = req.body;

    res.json({ message: "Workflow started", jobId: Date.now() });

    // Run workflow in background
    const orchestrator = new VehicleDataOrchestrator();

    const user = vins.length > 0 ? { email: userEmail, vins } : null;

    const result = await orchestrator.runCompleteWorkflow({
      user,
      skipScraping,
      exportFormat,
    });

    console.log("✅ Workflow completed:", result);
  } catch (error) {
    console.error("❌ Workflow failed:", error.message);
  }
});

// Run scraping only
app.post("/api/scrape", async (req, res) => {
  try {
    res.json({ message: "Scraping job started" });

    const orchestrator = new VehicleDataOrchestrator();
    await orchestrator.runCompleteWorkflow({
      user: null,
      skipScraping: false,
      exportFormat: "json",
    });
  } catch (error) {
    console.error("❌ Scraping failed:", error.message);
  }
});

// Run vAuto annotation only
app.post("/api/annotate", async (req, res) => {
  try {
    const {
      vins = [],
      userEmail = "web-user@example.com",
      exportFormat = "xlsx",
    } = req.body;

    if (vins.length === 0) {
      return res.status(400).json({ error: "VINs required for annotation" });
    }

    res.json({ message: "Annotation job started", vins: vins.length });

    const orchestrator = new VehicleDataOrchestrator();
    const user = { email: userEmail, vins };

    await orchestrator.runAnnotationOnly(user, { exportFormat });
  } catch (error) {
    console.error("❌ Annotation failed:", error.message);
  }
});

// Export existing file
app.post("/api/export", async (req, res) => {
  try {
    const { filename, format = "xlsx" } = req.body;

    const orchestrator = new VehicleDataOrchestrator();
    const inputFile = filename ? path.join(DATA_DIR, filename) : null;

    const result = await orchestrator.exportExistingData(inputFile, format);

    res.json({
      message: "Export completed",
      exportFile: path.basename(result.exportFile),
      recordCount: result.recordCount,
    });
  } catch (error) {
    res.status(500).json({ error: "Export failed: " + error.message });
  }
});

// Upload new JSON file
app.post("/api/upload", async (req, res) => {
  try {
    const { data, filename } = req.body;

    // Validate it's valid JSON
    JSON.parse(data);

    const targetFile = filename || `vehicles_upload_${Date.now()}.json`;
    const filePath = path.join(DATA_DIR, targetFile);

    // Write new data
    await fs.writeFile(filePath, data);

    res.json({ message: "File uploaded successfully", filename: targetFile });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload file: " + error.message });
  }
});

// Root endpoint redirect
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vehicle Data Bot</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .status { padding: 20px; background: #e8f5e8; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 10px 20px; background: #007cba; color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
      </style>
    </head>
    <body>
      <h1>🚗 Vehicle Data Bot</h1>
      <div class="status">
        <h3>✅ Application is running</h3>
        <p><strong>Mode:</strong> ${process.env.MODE || "web"}</p>
        <p><strong>Environment:</strong> ${
          process.env.NODE_ENV || "development"
        }</p>
        <p><strong>Node Version:</strong> ${process.version}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
      
      <h3>Available Endpoints:</h3>
      <ul>
        <li><a href="/api/files" class="button">📁 View Files API</a></li>
        <li><a href="/health" class="button">🔍 Health Check</a></li>
      </ul>
      
      <h3>Features:</h3>
      <ul>
        <li>Vehicle data scraping from CarMax</li>
        <li>vAuto evaluation annotation</li>
        <li>Data export in multiple formats</li>
        <li>Web-based file management</li>
      </ul>
    </body>
    </html>
  `);
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌐 Web interface running on port ${PORT}`);
  });
}
