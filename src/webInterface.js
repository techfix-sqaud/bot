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

// Get list of all data files with vehicle counts
app.get("/api/files", async (req, res) => {
  try {
    const files = await getAvailableFiles();

    // Add vehicle count to each file
    const filesWithCounts = await Promise.all(
      files.map(async (file) => {
        try {
          const data = await fs.readFile(file.path, "utf8");
          const vehicles = JSON.parse(data);
          return {
            ...file,
            vehicleCount: Array.isArray(vehicles) ? vehicles.length : 0,
          };
        } catch (error) {
          return {
            ...file,
            vehicleCount: 0,
          };
        }
      })
    );

    res.json({ files: filesWithCounts });
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

// Run scraping with real-time status updates
app.post("/api/scrape", async (req, res) => {
  try {
    const { exportFormat = "json" } = req.body;
    const jobId = Date.now().toString();

    // Store job status
    global.jobStatus = global.jobStatus || {};
    global.jobCancellation = global.jobCancellation || {};
    global.jobStatus[jobId] = {
      status: "starting",
      stage: "carmax",
      message: "Starting CarMax scraping...",
      startTime: new Date(),
      carmaxFile: null,
      finalFile: null,
      cancellable: true,
    };
    global.jobCancellation[jobId] = false;

    res.json({
      message: "Scraping job started",
      jobId,
      status: "started",
    });

    // Run workflow in background
    (async () => {
      try {
        // Check for cancellation before starting
        if (global.jobCancellation[jobId]) {
          global.jobStatus[jobId].status = "cancelled";
          global.jobStatus[jobId].message = "Job was cancelled before starting";
          global.jobStatus[jobId].endTime = new Date();
          return;
        }

        const orchestrator = new VehicleDataOrchestrator();

        // Update status
        global.jobStatus[jobId].status = "running";
        global.jobStatus[jobId].message = "Scraping CarMax data...";

        // Step 1: Run CarMax scraper with cancellation support
        const carmaxResults = await orchestrator.runCarmaxOnly(jobId);

        // Check for cancellation after CarMax
        if (global.jobCancellation[jobId] || carmaxResults.cancelled) {
          global.jobStatus[jobId].status = "cancelled";
          global.jobStatus[jobId].message =
            "Job was cancelled during CarMax scraping";
          global.jobStatus[jobId].endTime = new Date();
          global.jobStatus[jobId].partialResults = carmaxResults;
          return;
        }

        global.jobStatus[jobId].carmaxFile = carmaxResults.jsonFile;
        global.jobStatus[jobId].stage = "vauto";
        global.jobStatus[jobId].message =
          "CarMax completed. Running vAuto annotation...";

        // Step 2: Run vAuto on the latest file with cancellation support
        const vautoResults = await orchestrator.runVautoOnLatest(jobId);

        // Check for cancellation after vAuto
        if (global.jobCancellation[jobId] || vautoResults.cancelled) {
          global.jobStatus[jobId].status = "cancelled";
          global.jobStatus[jobId].message =
            "Job was cancelled during vAuto annotation";
          global.jobStatus[jobId].endTime = new Date();
          global.jobStatus[jobId].partialResults = {
            carmaxResults,
            vautoResults,
          };
          return;
        }

        global.jobStatus[jobId].finalFile = vautoResults.jsonFile;
        global.jobStatus[jobId].status = "completed";
        global.jobStatus[jobId].message = "Scraping completed successfully";
        global.jobStatus[jobId].endTime = new Date();
        global.jobStatus[jobId].cancellable = false;
        global.jobStatus[jobId].results = {
          carmaxVehicles: carmaxResults.summary.total,
          vautoProcessed: vautoResults.summary.successful,
          exportFormat,
        };

        console.log("✅ Complete scraping workflow finished");
      } catch (error) {
        // Check if this was a cancellation
        if (error.message && error.message.includes("cancelled")) {
          global.jobStatus[jobId].status = "cancelled";
          global.jobStatus[jobId].message =
            "Job was cancelled: " + error.message;
          global.jobStatus[jobId].endTime = new Date();
          global.jobStatus[jobId].cancellable = false;
          console.log("🛑 Scraping workflow was cancelled:", error.message);
        } else {
          global.jobStatus[jobId].status = "failed";
          global.jobStatus[jobId].message = error.message;
          global.jobStatus[jobId].endTime = new Date();
          global.jobStatus[jobId].cancellable = false;
          console.error("❌ Scraping failed:", error.message);
        }
      }
    })();
  } catch (error) {
    console.error("❌ Scraping startup failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get job status
app.get("/api/scrape/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = global.jobStatus?.[jobId];

    if (!status) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get job status" });
  }
});

// Cancel a running job
app.post("/api/scrape/cancel/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!global.jobStatus || !global.jobStatus[jobId]) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = global.jobStatus[jobId];

    if (job.status !== "running" && job.status !== "starting") {
      return res.status(400).json({
        error: "Job is not running and cannot be cancelled",
        currentStatus: job.status,
      });
    }

    // Set cancellation flag
    global.jobCancellation = global.jobCancellation || {};
    global.jobCancellation[jobId] = true;

    // Update job status
    job.status = "cancelling";
    job.message = "Cancellation requested, stopping gracefully...";
    job.cancellable = false;

    console.log(`🛑 Cancellation requested for job ${jobId}`);

    res.json({
      message: "Cancellation requested",
      jobId,
      status: "cancelling",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel job: " + error.message });
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

// Download file with format conversion
app.get("/api/download-converted/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const { format = "json" } = req.query;

    const filePath = path.join(DATA_DIR, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: "File not found" });
    }

    if (format === "json") {
      const data = await fs.readFile(filePath, "utf8");
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(data);
    } else {
      // Convert to requested format
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
      .json({ error: "Failed to convert and download file: " + error.message });
  }
});

// Delete a file
app.delete("/api/files/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(DATA_DIR, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: "File not found" });
    }

    // Prevent deletion of non-JSON files for security
    if (!filename.endsWith(".json")) {
      return res.status(400).json({ error: "Only JSON files can be deleted" });
    }

    // Delete the file
    await fs.unlink(filePath);

    console.log(`🗑️ Deleted file: ${filename}`);
    res.json({ message: "File deleted successfully", filename });
  } catch (error) {
    console.error("❌ Delete failed:", error.message);
    res.status(500).json({ error: "Failed to delete file: " + error.message });
  }
});

// Root endpoint with enhanced web interface
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vehicle Data Bot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          box-sizing: border-box;
        }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          max-width: 1200px; 
          margin: 0 auto; 
          padding: 10px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container {
          background: white;
          padding: 20px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .status { 
          padding: 15px; 
          background: linear-gradient(135deg, #e8f5e8, #f0f8f0); 
          border-radius: 10px; 
          margin: 15px 0; 
          border-left: 5px solid #28a745;
        }
        .button { 
          display: inline-block; 
          padding: 12px 20px; 
          background: linear-gradient(135deg, #007cba, #0056b3); 
          color: white; 
          text-decoration: none; 
          border-radius: 8px; 
          margin: 5px; 
          border: none;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
          text-align: center;
          min-width: 120px;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,123,186,0.3);
        }
        .button.danger {
          background: linear-gradient(135deg, #dc3545, #c82333);
        }
        .button.success {
          background: linear-gradient(135deg, #28a745, #218838);
        }
        .button.cancel {
          background: linear-gradient(135deg, #ffc107, #e0a800);
          color: #212529;
        }
        .button.cancel:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(255,193,7,0.3);
        }
        .section {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          background: #f8f9fa;
        }
        .job-status {
          padding: 15px;
          margin: 10px 0;
          border-radius: 8px;
          border: 1px solid #dee2e6;
          background: white;
        }
        .status-running { border-left: 4px solid #ffc107; }
        .status-completed { border-left: 4px solid #28a745; }
        .status-failed { border-left: 4px solid #dc3545; }
        .file-item {
          display: flex;
          flex-direction: column;
          padding: 15px;
          margin: 10px 0;
          background: white;
          border-radius: 8px;
          border: 1px solid #dee2e6;
          gap: 10px;
        }
        .file-info {
          flex-grow: 1;
        }
        .file-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin: 8px 0;
          font-size: 13px;
          color: #6c757d;
        }
        .file-stat {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .file-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        select {
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 5px;
          margin: 0;
          min-width: 120px;
        }
        
        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .container {
            padding: 15px;
            margin: 5px;
          }
          .file-item {
            flex-direction: column;
            gap: 15px;
          }
          .file-actions {
            justify-content: flex-start;
            width: 100%;
          }
          .file-actions select {
            flex: 1;
            min-width: 100px;
          }
          .file-actions .button {
            flex: 1;
            min-width: 80px;
            padding: 10px 8px;
            font-size: 12px;
          }
          .file-stats {
            gap: 10px;
          }
          .status {
            padding: 12px;
          }
          .section {
            padding: 12px;
            margin: 15px 0;
          }
          h1 {
            font-size: 24px;
          }
          h3 {
            font-size: 18px;
          }
        }
        .loading {
          display: none;
          text-align: center;
          padding: 20px;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007cba;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        h1 { 
          color: #2c3e50; 
          text-align: center; 
          font-size: 2em;
          margin-bottom: 20px;
        }
        h2, h3 { 
          color: #34495e; 
          margin-bottom: 15px;
        }
        
        /* Mobile responsive styles */
        @media (max-width: 768px) {
          body {
            padding: 5px;
          }
          .container {
            padding: 15px;
            border-radius: 10px;
          }
          .status {
            padding: 10px;
          }
          .section {
            margin: 15px 0;
            padding: 10px;
          }
          .button {
            width: 100%;
            margin: 5px 0;
            padding: 15px;
            font-size: 16px;
          }
          .file-item {
            padding: 10px;
          }
          .file-actions {
            width: 100%;
          }
          .file-actions select,
          .file-actions button {
            flex: 1;
            margin: 2px 0;
          }
          h1 {
            font-size: 1.8em;
          }
          h3 {
            font-size: 1.2em;
          }
          .file-stats {
            flex-direction: column;
            gap: 8px;
          }
        }
        
        @media (max-width: 480px) {
          .container {
            padding: 10px;
          }
          h1 {
            font-size: 1.5em;
          }
          .status p {
            font-size: 14px;
          }
          .file-stat {
            font-size: 12px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚗 Vehicle Data Bot</h1>
        
        <div class="status">
          <h3>✅ Application Status</h3>
          <p><strong>Mode:</strong> ${process.env.MODE || "web"}</p>
          <p><strong>Environment:</strong> ${
            process.env.NODE_ENV || "development"
          }</p>
          <p><strong>Node Version:</strong> ${process.version}</p>
          <p><strong>Last Updated:</strong> ${new Date().toISOString()}</p>
        </div>

        <div class="section">
          <h3>🚀 Run Vehicle Data Scraper</h3>
          <p>This will run CarMax scraping first, then vAuto annotation on the results.</p>
          <button class="button success" onclick="startScraping()">▶️ Start Scraping Process</button>
          <div id="scrapingStatus" class="loading">
            <div class="spinner"></div>
            <p>Processing... This may take several minutes.</p>
            <div id="statusDetails"></div>
            <button id="cancelButton" class="button cancel" onclick="cancelScraping()" style="display: none; margin-top: 15px;">🛑 Cancel Scraping</button>
          </div>
        </div>

        <div class="section">
          <h3>📁 Available Files</h3>
          <button class="button" onclick="refreshFiles()">🔄 Refresh File List</button>
          <div id="filesList">Loading files...</div>
        </div>

        <div class="section">
          <h3>🔗 API Endpoints</h3>
          <a href="/api/files" class="button">📁 Files API</a>
          <a href="/health" class="button">🔍 Health Check</a>
        </div>
      </div>

      <script>
        let currentJobId = null;
        let statusCheckInterval = null;

        async function startScraping() {
          try {
            document.getElementById('scrapingStatus').style.display = 'block';
            document.getElementById('statusDetails').innerHTML = 'Starting scraping process...';
            document.getElementById('cancelButton').style.display = 'none';
            
            const response = await fetch('/api/scrape', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ exportFormat: 'json' })
            });
            
            const result = await response.json();
            currentJobId = result.jobId;
            
            // Show cancel button
            document.getElementById('cancelButton').style.display = 'inline-block';
            
            // Start checking status
            statusCheckInterval = setInterval(checkScrapingStatus, 2000);
            
          } catch (error) {
            document.getElementById('statusDetails').innerHTML = 'Error: ' + error.message;
            document.getElementById('cancelButton').style.display = 'none';
          }
        }

        async function cancelScraping() {
          if (!currentJobId) return;
          
          try {
            document.getElementById('cancelButton').disabled = true;
            document.getElementById('cancelButton').textContent = '🔄 Cancelling...';
            
            const response = await fetch('/api/scrape/cancel/' + currentJobId, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok) {
              document.getElementById('statusDetails').innerHTML = 'Cancellation requested. Waiting for graceful shutdown...';
            } else {
              alert('Failed to cancel: ' + result.error);
              document.getElementById('cancelButton').disabled = false;
              document.getElementById('cancelButton').textContent = '🛑 Cancel Scraping';
            }
          } catch (error) {
            alert('Error cancelling job: ' + error.message);
            document.getElementById('cancelButton').disabled = false;
            document.getElementById('cancelButton').textContent = '🛑 Cancel Scraping';
          }
        }

        async function checkScrapingStatus() {
          if (!currentJobId) return;
          
          try {
            const response = await fetch('/api/scrape/status/' + currentJobId);
            const status = await response.json();
            
            let statusText = status.message;
            if (status.stage) {
              statusText += ' (Stage: ' + status.stage + ')';
            }
            
            document.getElementById('statusDetails').innerHTML = statusText;
            
            // Show/hide cancel button based on status
            const cancelButton = document.getElementById('cancelButton');
            if (status.cancellable && (status.status === 'running' || status.status === 'starting')) {
              cancelButton.style.display = 'inline-block';
              cancelButton.disabled = false;
              cancelButton.textContent = '🛑 Cancel Scraping';
            } else {
              cancelButton.style.display = 'none';
            }
            
            if (status.status === 'completed') {
              clearInterval(statusCheckInterval);
              document.getElementById('scrapingStatus').style.display = 'none';
              alert('Scraping completed successfully!');
              refreshFiles();
            } else if (status.status === 'failed') {
              clearInterval(statusCheckInterval);
              document.getElementById('statusDetails').innerHTML = 'Failed: ' + status.message;
              cancelButton.style.display = 'none';
            } else if (status.status === 'cancelled') {
              clearInterval(statusCheckInterval);
              let cancelMessage = 'Job was cancelled: ' + status.message;
              if (status.partialResults) {
                cancelMessage += '<br><br>📊 Partial results were saved and are available in the files list.';
              }
              document.getElementById('statusDetails').innerHTML = cancelMessage;
              cancelButton.style.display = 'none';
              alert('Scraping was cancelled. Check the files list for any partial results.');
              refreshFiles();
            } else if (status.status === 'cancelling') {
              cancelButton.style.display = 'none';
            }
          } catch (error) {
            console.error('Status check failed:', error);
          }
        }

        async function refreshFiles() {
          try {
            document.getElementById('filesList').innerHTML = '<p>Loading files and vehicle counts...</p>';
            
            const response = await fetch('/api/files');
            const data = await response.json();
            
            let html = '';
            if (data.files.length === 0) {
              html = '<p>No files found. Run the scraper to generate data.</p>';
            } else {
              // Get vehicle counts for each file
              const filesWithCounts = await Promise.all(
                data.files.map(async (file) => {
                  try {
                    const statsResponse = await fetch('/api/stats/' + file.name);
                    const stats = await statsResponse.json();
                    return { ...file, vehicleCount: stats.totalVehicles, hasVAutoData: stats.hasVAutoData };
                  } catch (error) {
                    return { ...file, vehicleCount: 'Error', hasVAutoData: 0 };
                  }
                })
              );
              
              filesWithCounts.forEach(file => {
                const size = Math.round(file.size / 1024);
                const date = new Date(file.modified).toLocaleString();
                const isAnnotated = file.isAnnotated ? '🔍 ' : '';
                const vehicleCount = file.vehicleCount;
                const vautoCount = file.hasVAutoData || 0;
                
                html += \`
                  <div class="file-item">
                    <div class="file-info">
                      <strong>\${isAnnotated}\${file.name}</strong>
                      <div class="file-stats">
                        <div class="file-stat">
                          <span>🚗</span>
                          <span><strong>\${vehicleCount}</strong> vehicles</span>
                        </div>
                        \${vautoCount > 0 ? \`
                          <div class="file-stat">
                            <span>🔍</span>
                            <span><strong>\${vautoCount}</strong> with vAuto data</span>
                          </div>
                        \` : ''}
                        <div class="file-stat">
                          <span>💾</span>
                          <span>\${size}KB</span>
                        </div>
                        <div class="file-stat">
                          <span>📅</span>
                          <span>\${date}</span>
                        </div>
                      </div>
                    </div>
                    <div class="file-actions">
                      <select id="format-\${file.name}">
                        <option value="json">JSON</option>
                        <option value="xlsx">Excel (XLSX)</option>
                        <option value="xls">Excel (XLS)</option>
                        <option value="csv">CSV</option>
                      </select>
                      <button class="button" onclick="downloadFile('\${file.name}')">⬇️ Download</button>
                      <button class="button danger" onclick="deleteFile('\${file.name}')">🗑️ Delete</button>
                    </div>
                  </div>
                \`;
              });
            }
            
            document.getElementById('filesList').innerHTML = html;
          } catch (error) {
            document.getElementById('filesList').innerHTML = 'Error loading files: ' + error.message;
          }
        }

        async function downloadFile(filename) {
          try {
            const format = document.getElementById('format-' + filename).value;
            const url = '/api/download-converted/' + filename + '?format=' + format;
            
            // Create a temporary link and click it to trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (error) {
            alert('Download failed: ' + error.message);
          }
        }

        async function deleteFile(filename) {
          // Confirm deletion
          if (!confirm(\`Are you sure you want to delete "\${filename}"? This action cannot be undone.\`)) {
            return;
          }
          
          try {
            const response = await fetch('/api/files/' + filename, {
              method: 'DELETE'
            });
            
            if (response.ok) {
              alert('File deleted successfully!');
              refreshFiles(); // Refresh the file list
            } else {
              const error = await response.json();
              alert('Delete failed: ' + error.error);
            }
          } catch (error) {
            alert('Delete failed: ' + error.message);
          }
        }

        // Load files on page load
        refreshFiles();
      </script>
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

// Cleanup old job statuses (run every hour)
setInterval(() => {
  if (global.jobStatus) {
    const now = new Date();
    const oldJobs = [];

    for (const [jobId, job] of Object.entries(global.jobStatus)) {
      const jobAge = now - new Date(job.startTime);
      const maxAge = 4 * 60 * 60 * 1000; // 4 hours

      if (
        jobAge > maxAge &&
        ["completed", "failed", "cancelled"].includes(job.status)
      ) {
        oldJobs.push(jobId);
      }
    }

    oldJobs.forEach((jobId) => {
      delete global.jobStatus[jobId];
      if (global.jobCancellation) {
        delete global.jobCancellation[jobId];
      }
    });

    if (oldJobs.length > 0) {
      console.log(`🧹 Cleaned up ${oldJobs.length} old job statuses`);
    }
  }
}, 60 * 60 * 1000); // Run every hour
