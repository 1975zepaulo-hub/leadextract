const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
app.use(cors());
app.use(express.json());

// Path to your compiled scraper binary
const SCRAPER_PATH = path.join(__dirname, "..", "..", "google-maps-scraper", "google-maps-scraper.exe");

// Plan limits (number of results allowed per extraction)
const PLAN_LIMITS = {
  free: 100,
  starter: 5000,
  growth: 20000,
  agency: 100000,
};

// In-memory job store (swap for a DB in production)
const jobs = {};

// In-memory usage store (swap for Supabase/DB in production)
const usage = {};

function getUserUsage(userId) {
  if (!usage[userId]) usage[userId] = { plan: "free", used: 0, resetAt: nextMonthDate() };
  return usage[userId];
}

function nextMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// POST /api/scrape — start a scrape job
app.post("/api/scrape", (req, res) => {
  const { keyword, location, userId = "demo", plan = "free", noWebsiteOnly = false } = req.body;

  if (!keyword || !location) {
    return res.status(400).json({ error: "keyword and location are required" });
  }

  const userUsage = getUserUsage(userId);
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  if (userUsage.used >= limit) {
    return res.status(403).json({
      error: `Plan limit reached. You've used ${userUsage.used}/${limit} extractions this month. Upgrade to continue.`,
    });
  }

  const jobId = uuidv4();
  const tmpDir = path.join(os.tmpdir(), "leadsaas", jobId);
  fs.mkdirSync(tmpDir, { recursive: true });

  const queryFile = path.join(tmpDir, "query.txt");
  const resultsFile = path.join(tmpDir, "results.csv");
  const query = `${keyword} in ${location}`;

  fs.writeFileSync(queryFile, query, "utf8");

  jobs[jobId] = {
    id: jobId,
    status: "running",
    query,
    noWebsiteOnly,
    resultsFile,
    startedAt: new Date().toISOString(),
    userId,
    plan,
    logs: [],
  };

  const depth = plan === "free" ? 1 : plan === "starter" ? 3 : plan === "growth" ? 6 : 10;
  const concurrency = plan === "free" ? 2 : plan === "starter" ? 4 : 8;

  const args = [
    "-input", queryFile,
    "-results", resultsFile,
    "-depth", String(depth),
    "-c", String(concurrency),
    "-exit-on-inactivity", "3m",
  ];

  const proc = spawn(SCRAPER_PATH, args);

  proc.stdout.on("data", (d) => jobs[jobId].logs.push(d.toString()));
  proc.stderr.on("data", (d) => jobs[jobId].logs.push(d.toString()));

  proc.on("close", (code) => {
    jobs[jobId].status = code === 0 ? "done" : "error";
    jobs[jobId].finishedAt = new Date().toISOString();

    if (code === 0 && fs.existsSync(resultsFile)) {
      let rows = fs.readFileSync(resultsFile, "utf8").split("\n").filter(Boolean);
      const header = rows[0];
      let data = rows.slice(1);

      if (noWebsiteOnly) {
        const headers = header.split(",");
        const websiteIdx = headers.findIndex((h) => h.toLowerCase().includes("website"));
        if (websiteIdx !== -1) {
          data = data.filter((row) => {
            const cols = row.split(",");
            return !cols[websiteIdx] || cols[websiteIdx].trim() === "";
          });
        }
      }

      jobs[jobId].totalResults = data.length;
      userUsage.used += data.length;

      // Save filtered results back
      const filtered = [header, ...data].join("\n");
      fs.writeFileSync(resultsFile, filtered, "utf8");
    }
  });

  res.json({ jobId, status: "running", query });
});

// GET /api/job/:id — check job status
app.get("/api/job/:id", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({
    id: job.id,
    status: job.status,
    query: job.query,
    totalResults: job.totalResults || 0,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
  });
});

// GET /api/job/:id/download — download CSV
app.get("/api/job/:id/download", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "done") return res.status(400).json({ error: "Job not finished yet" });
  if (!fs.existsSync(job.resultsFile)) return res.status(404).json({ error: "Results file not found" });

  const filename = `leads-${job.query.replace(/\s+/g, "-")}.csv`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "text/csv");
  fs.createReadStream(job.resultsFile).pipe(res);
});

// GET /api/usage/:userId — get usage info
app.get("/api/usage/:userId", (req, res) => {
  const u = getUserUsage(req.params.userId);
  const limit = PLAN_LIMITS[u.plan] || PLAN_LIMITS.free;
  res.json({ plan: u.plan, used: u.used, limit, remaining: limit - u.used });
});

// Upgrade plan (mock — wire to Stripe webhook in production)
app.post("/api/upgrade", (req, res) => {
  const { userId, plan } = req.body;
  if (!PLAN_LIMITS[plan]) return res.status(400).json({ error: "Invalid plan" });
  const u = getUserUsage(userId);
  u.plan = plan;
  u.used = 0;
  res.json({ success: true, plan, limit: PLAN_LIMITS[plan] });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LeadsSaaS backend running on http://localhost:${PORT}`));
