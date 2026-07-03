const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { expandQueries } = require("./locations");

const app = express();
app.use(cors());
app.use(express.json());

const SCRAPER_PATH = path.join(__dirname, "..", "..", "google-maps-scraper", "google-maps-scraper.exe");

const PLAN_LIMITS = {
  free: 100,
  starter: 5000,
  growth: 20000,
  agency: 100000,
};

const PLAN_DEPTH = { free: 1, starter: 3, growth: 6, agency: 10 };
const PLAN_CONCURRENCY = { free: 2, starter: 4, growth: 8, agency: 16 };

const jobs = {};
const usage = {};

function getUserUsage(userId) {
  if (!usage[userId]) usage[userId] = { plan: "free", used: 0 };
  return usage[userId];
}

// POST /api/scrape
app.post("/api/scrape", async (req, res) => {
  const { keyword, location, userId = "demo", plan = "free", noWebsiteOnly = false } = req.body;

  if (!keyword || !location) {
    return res.status(400).json({ error: "keyword and location are required" });
  }

  const userUsage = getUserUsage(userId);
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  if (userUsage.used >= limit) {
    return res.status(403).json({
      error: `Plan limit reached (${userUsage.used}/${limit}). Upgrade to continue.`,
    });
  }

  // Auto-expand into sub-area queries
  const queries = expandQueries(keyword, location);

  const jobId = uuidv4();
  const tmpDir = path.join(os.tmpdir(), "leadsaas", jobId);
  fs.mkdirSync(tmpDir, { recursive: true });

  const queryFile = path.join(tmpDir, "queries.txt");
  const resultsFile = path.join(tmpDir, "results.csv");

  fs.writeFileSync(queryFile, queries.join("\n"), "utf8");

  jobs[jobId] = {
    id: jobId,
    status: "running",
    keyword,
    location,
    queries,
    noWebsiteOnly,
    resultsFile,
    startedAt: new Date().toISOString(),
    userId,
    plan,
    totalResults: 0,
    logs: [],
  };

  const depth = PLAN_DEPTH[plan] || 1;
  const concurrency = PLAN_CONCURRENCY[plan] || 2;

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
    const job = jobs[jobId];
    job.status = code === 0 ? "done" : "error";
    job.finishedAt = new Date().toISOString();

    if (code === 0 && fs.existsSync(resultsFile)) {
      let lines = fs.readFileSync(resultsFile, "utf8").split("\n").filter(Boolean);
      const header = lines[0];
      let data = lines.slice(1);

      // Deduplicate by title+address (columns 2 and 4 in default CSV)
      const seen = new Set();
      data = data.filter((row) => {
        const key = row.split(",").slice(0, 5).join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Filter no-website if requested
      if (noWebsiteOnly) {
        const headers = header.split(",");
        const websiteIdx = headers.findIndex((h) => h.toLowerCase().includes("website"));
        if (websiteIdx !== -1) {
          data = data.filter((row) => {
            const col = row.split(",")[websiteIdx];
            return !col || col.trim() === "";
          });
        }
      }

      job.totalResults = data.length;
      userUsage.used += data.length;

      fs.writeFileSync(resultsFile, [header, ...data].join("\n"), "utf8");
    }
  });

  res.json({
    jobId,
    status: "running",
    keyword,
    location,
    queriesExpanded: queries.length,
    queries,
  });
});

// GET /api/job/:id
app.get("/api/job/:id", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({
    id: job.id,
    status: job.status,
    keyword: job.keyword,
    location: job.location,
    queriesExpanded: job.queries?.length || 1,
    totalResults: job.totalResults || 0,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
  });
});

// GET /api/job/:id/download
app.get("/api/job/:id/download", (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "done") return res.status(400).json({ error: "Job not finished" });
  if (!fs.existsSync(job.resultsFile)) return res.status(404).json({ error: "File not found" });

  const filename = `leads-${job.keyword}-${job.location}.csv`.replace(/\s+/g, "-").toLowerCase();
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "text/csv");
  fs.createReadStream(job.resultsFile).pipe(res);
});

// GET /api/usage/:userId
app.get("/api/usage/:userId", (req, res) => {
  const u = getUserUsage(req.params.userId);
  const limit = PLAN_LIMITS[u.plan] || PLAN_LIMITS.free;
  res.json({ plan: u.plan, used: u.used, limit, remaining: limit - u.used });
});

// POST /api/upgrade
app.post("/api/upgrade", (req, res) => {
  const { userId, plan } = req.body;
  if (!PLAN_LIMITS[plan]) return res.status(400).json({ error: "Invalid plan" });
  const u = getUserUsage(userId);
  u.plan = plan;
  u.used = 0;
  res.json({ success: true, plan, limit: PLAN_LIMITS[plan] });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`LeadsSaaS backend on http://localhost:${PORT}`));
