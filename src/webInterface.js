const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "../data/vehicles.json");

app.use(express.json({ limit: "50mb" }));

// Download the JSON file
app.get("/download", async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="vehicles.json"'
    );
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to read file" });
  }
});

// Get file stats
app.get("/stats", async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    const vehicles = JSON.parse(data);
    const stats = await fs.stat(DATA_FILE);

    res.json({
      totalVehicles: vehicles.length,
      fileSize: stats.size,
      lastModified: stats.mtime,
      hasVAutoData: vehicles.filter((v) => v.vautoData).length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// Upload new JSON file
app.post("/upload", async (req, res) => {
  try {
    const { data } = req.body;

    // Validate it's valid JSON
    JSON.parse(data);

    // Backup existing file
    const backupFile = DATA_FILE + ".backup." + Date.now();
    await fs.copyFile(DATA_FILE, backupFile);

    // Write new data
    await fs.writeFile(DATA_FILE, data);

    res.json({ message: "File updated successfully", backup: backupFile });
  } catch (error) {
    res.status(500).json({ error: "Failed to update file: " + error.message });
  }
});

// Run scraping job manually
app.post("/scrape", async (req, res) => {
  try {
    res.json({ message: "Scraping job started" });

    // Run the scraper in background
    const enrichVehiclesWithVAuto = require("./carmaxVautoScraper");
    enrichVehiclesWithVAuto().catch(console.error);
  } catch (error) {
    res.status(500).json({ error: "Failed to start scraping job" });
  }
});

// Simple web interface
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Vehicle Bot Manager</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            button { padding: 10px 20px; margin: 10px; background: #007cba; color: white; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #005a8b; }
            .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
            #upload { margin: 20px 0; }
        </style>
    </head>
    <body>
        <h1>Vehicle Bot Manager</h1>
        
        <div class="stats" id="stats">Loading stats...</div>
        
        <button onclick="downloadFile()">Download vehicles.json</button>
        <button onclick="runScraper()">Run Scraper</button>
        
        <div id="upload">
            <h3>Upload New vehicles.json</h3>
            <input type="file" id="fileInput" accept=".json">
            <button onclick="uploadFile()">Upload</button>
        </div>
        
        <script>
            async function loadStats() {
                try {
                    const response = await fetch('/stats');
                    const stats = await response.json();
                    document.getElementById('stats').innerHTML = \`
                        <h3>File Statistics</h3>
                        <p><strong>Total Vehicles:</strong> \${stats.totalVehicles}</p>
                        <p><strong>Vehicles with vAuto data:</strong> \${stats.hasVAutoData}</p>
                        <p><strong>File Size:</strong> \${(stats.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                        <p><strong>Last Modified:</strong> \${new Date(stats.lastModified).toLocaleString()}</p>
                    \`;
                } catch (error) {
                    document.getElementById('stats').innerHTML = 'Error loading stats';
                }
            }
            
            function downloadFile() {
                window.location.href = '/download';
            }
            
            async function runScraper() {
                try {
                    const response = await fetch('/scrape', { method: 'POST' });
                    const result = await response.json();
                    alert(result.message);
                } catch (error) {
                    alert('Error starting scraper');
                }
            }
            
            async function uploadFile() {
                const fileInput = document.getElementById('fileInput');
                const file = fileInput.files[0];
                
                if (!file) {
                    alert('Please select a file');
                    return;
                }
                
                const text = await file.text();
                
                try {
                    const response = await fetch('/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: text })
                    });
                    const result = await response.json();
                    alert(result.message);
                    loadStats();
                } catch (error) {
                    alert('Error uploading file');
                }
            }
            
            loadStats();
            setInterval(loadStats, 30000); // Refresh every 30 seconds
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
