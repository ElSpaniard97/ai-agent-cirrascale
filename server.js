import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================
   ENV VALIDATION
========================= */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// Validate all required environment variables on startup
const requiredEnvVars = [
  "OPENAI_API_KEY",
  "JWT_SECRET",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD_HASH"
];

console.log("Validating environment variables...");
requiredEnvVars.forEach((varName) => {
  try {
    requireEnv(varName);
    console.log(`✓ ${varName} is set`);
  } catch (err) {
    console.error(`✗ ${varName} is missing`);
    if (varName === "ADMIN_PASSWORD_HASH") {
      console.error(
        "To generate a password hash, run: node -e \"console.log(require('bcryptjs').hashSync('your-password', 10))\""
      );
    }
    process.exit(1);
  }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* =========================
   CORS CONFIGURATION
========================= */
const ALLOWED_ORIGINS = new Set([
  const ALLOWED_ORIGINS = new Set([
     "https://elspaniard97.github.io",
     "http://localhost:5500"
]);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      console.warn(`CORS blocked origin: ${origin}`);
      return cb(new Error(`CORS policy: Origin ${origin} is not allowed`), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204
  })
);

app.use(express.json({ limit: "10mb" }));

/* =========================
   MULTER FILE UPLOAD
========================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 6 * 1024 * 1024, // 6MB for screenshots
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

const uploadScript = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 512 * 1024, // 512KB per script
    files: 1
  }
});

/* =========================
   AUTHENTICATION
========================= */
function issueToken(username) {
  const secret = requireEnv("JWT_SECRET");
  return jwt.sign(
    { sub: username, iat: Math.floor(Date.now() / 1000) },
    secret,
    { expiresIn: "8h" }
  );
}

function authMiddleware(req, res, next) {
  try {
    const secret = requireEnv("JWT_SECRET");
    const auth = req.headers.authorization || "";
    const [scheme, token] = auth.split(" ");
    
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ ok: false, error: "Unauthorized: Missing or invalid token" });
    }
    
    const payload = jwt.verify(token, secret);
    req.user = payload;
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ ok: false, error: "Unauthorized: Token expired" });
    }
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid token" });
  }
}

/* =========================
   SETTINGS STORAGE
========================= */
const SETTINGS_PATH = process.env.SETTINGS_PATH || "/data/settings.json";

function defaultSettings() {
  return {
    defaultPreset: "",
    expandOnPreset: true,
    rememberApproval: true,
    defaultApproval: false,
    theme: "system"
  };
}

function sanitizeSettings(input) {
  const base = defaultSettings();
  const out = { ...base };
  
  if (!input || typeof input !== "object") return out;

  if (typeof input.defaultPreset === "string") {
    out.defaultPreset = input.defaultPreset;
  }
  if (typeof input.expandOnPreset === "boolean") {
    out.expandOnPreset = input.expandOnPreset;
  }
  if (typeof input.rememberApproval === "boolean") {
    out.rememberApproval = input.rememberApproval;
  }
  if (typeof input.defaultApproval === "boolean") {
    out.defaultApproval = input.defaultApproval;
  }
  if (["system", "dark", "light"].includes(input.theme)) {
    out.theme = input.theme;
  }

  const allowedPresets = new Set(["", "network", "server", "script", "hardware"]);
  if (!allowedPresets.has(out.defaultPreset)) {
    out.defaultPreset = "";
  }
  
  return out;
}

async function ensureDirForFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    return json && typeof json === "object" ? json : {};
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeJsonFileAtomic(filePath, obj) {
  await ensureDirForFile(filePath);
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

/* =========================
   SCRIPT STORAGE
========================= */
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || "/data/scripts";
const SCRIPTS_INDEX_PATH = path.join(SCRIPTS_DIR, "index.json");

function userKey(req) {
  return String(req.user?.sub || "").trim();
}

function safeTextFromBuffer(buf) {
  if (!Buffer.isBuffer(buf)) {
    throw new Error("Invalid file buffer");
  }
  
  // Reject files with null bytes (likely binary)
  if (buf.includes(0)) {
    throw new Error("File appears to be binary (null bytes found). Please upload text files only.");
  }

  // Decode as UTF-8
  const text = buf.toString("utf8");

  // Reject files with excessive replacement characters (encoding issues)
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCount > 10) {
    throw new Error("File encoding appears invalid. Please ensure UTF-8 encoding.");
  }

  return text;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .map(String)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function detectLanguageByExt(filename = "") {
  const ext = filename.toLowerCase().split(".").pop();
  const languageMap = {
    ps1: "PowerShell",
    py: "Python",
    sh: "Bash",
    bash: "Bash",
    yaml: "YAML",
    yml: "YAML",
    json: "JSON",
    tf: "Terraform",
    hcl: "HCL",
    js: "JavaScript",
    ts: "TypeScript",
    go: "Go",
    java: "Java",
    cs: "C#",
    cpp: "C++",
    c: "C",
    rb: "Ruby",
    php: "PHP",
    pl: "Perl",
    txt: "Text"
  };
  return languageMap[ext] || "Text";
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

async function readScriptsIndex() {
  return await readJsonFile(SCRIPTS_INDEX_PATH);
}

async function writeScriptsIndex(indexObj) {
  await writeJsonFileAtomic(SCRIPTS_INDEX_PATH, indexObj);
}

function scriptFolder(username, scriptId) {
  // Sanitize paths to prevent directory traversal
  const safeUser = username.replace(/[^\w.-]/g, "_");
  const safeId = String(scriptId).replace(/[^\w-]/g, "");
  return path.join(SCRIPTS_DIR, safeUser, safeId);
}

async function saveScript(username, meta, contentText) {
  const scriptId = meta.id || newId();
  const folder = scriptFolder(username, scriptId);
  const scriptPath = path.join(folder, "script.txt");
  const metaPath = path.join(folder, "meta.json");

  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(scriptPath, contentText, "utf8");
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

  // Update index
  const indexObj = await readScriptsIndex();
  if (!indexObj[username]) indexObj[username] = {};
  indexObj[username][scriptId] = meta;
  await writeScriptsIndex(indexObj);

  return { id: scriptId, meta };
}

async function listScripts(username) {
  const indexObj = await readScriptsIndex();
  const byUser = indexObj[username] || {};
  return Object.values(byUser).sort((a, b) => {
    const dateA = b.updatedAt || b.createdAt || "";
    const dateB = a.updatedAt || a.createdAt || "";
    return dateA.localeCompare(dateB);
  });
}

async function getScript(username, scriptId) {
  const indexObj = await readScriptsIndex();
  const meta = indexObj[username]?.[scriptId];
  if (!meta) return null;

  const folder = scriptFolder(username, scriptId);
  const scriptPath = path.join(folder, "script.txt");
  
  try {
    const content = await fs.readFile(scriptPath, "utf8");
    return { meta, content };
  } catch (err) {
    console.error(`Failed to read script ${scriptId}:`, err);
    return null;
  }
}

async function deleteScript(username, scriptId) {
  const indexObj = await readScriptsIndex();
  if (!indexObj[username]?.[scriptId]) return false;

  // Remove folder
  const folder = scriptFolder(username, scriptId);
  await fs.rm(folder, { recursive: true, force: true });

  // Update index
  delete indexObj[username][scriptId];
  await writeScriptsIndex(indexObj);
  return true;
}

/* =========================
   TROUBLESHOOTING HELPERS
========================= */
function parseHistory(raw) {
  if (!raw) return [];
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
}

function approvalStateFromMessage(message) {
  const head = String(message || "").split("\n")[0] || "";
  return head.includes("APPROVAL: APPROVED") ? "approved" : "not_approved";
}

function buildSystemPrompt(approvalState) {
  const base = `You are an enterprise infrastructure troubleshooting agent specializing in:
- Networking (switches, routers, VLANs, routing, STP)
- Server OS/Services (Linux, Windows, logs, performance)
- Scripts/Automation (PowerShell, Python, Bash, Ansible, Terraform, YAML, JSON)
- Hardware/Components (iDRAC, iLO, IPMI, RAID, thermals, PSU, ECC)

OPERATING RULES:
1. Diagnostics-first: Always start by clarifying scope, impact, recent changes, and collecting evidence
2. Ticket-safe output: Never request or display secrets (keys, passwords). Recommend redaction for sensitive data
3. Be explicit and structured: Provide commands/steps AND explain what to look for in the output
4. Safety priority: Avoid risky or production-impacting changes unless explicit APPROVAL is confirmed
5. Script references: When scripts are provided, reference them by NAME and cite approximate line ranges

RESPONSE FORMAT (always follow this structure):
A) Quick Triage (2-6 bullet points summarizing the situation)
B) Likely Causes (ranked by probability with brief explanation)
C) Evidence to Collect (specific commands + what to look for in output)
D) Decision Tree / Next Steps (conditional logic based on findings)
E) Remediation Plan (ONLY if APPROVED: change steps + rollback + validation)

`;

  if (approvalState === "approved") {
    return base + `
APPROVAL STATUS: ✓ APPROVED
You may provide remediation plans that modify production configuration. Always include:
- Explicit change steps with commands
- Rollback procedure
- Validation steps to confirm success
- Risk assessment and prerequisites (backups, maintenance window, etc.)
`;
  } else {
    return base + `
APPROVAL STATUS: ✗ NOT APPROVED
You are in diagnostics-only mode. Do NOT provide production-impacting remediation steps.
Focus on data collection, analysis, and decision points. Suggest safe mitigations only.
`;
  }
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (x) =>
        x &&
        (x.role === "user" || x.role === "assistant") &&
        typeof x.content === "string" &&
        x.content.trim().length > 0
    )
    .slice(-12) // Keep last 12 messages for context
    .map((x) => ({ role: x.role, content: x.content.trim() }));
}

function addLineNumbers(text) {
  const lines = String(text).split("\n");
  return lines.map((ln, i) => `${String(i + 1).padStart(4, " ")} | ${ln}`).join("\n");
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return (
    text.slice(0, half) +
    `\n\n[... TRUNCATED: showing first and last ${half} characters of ${text.length} total ...]\n\n` +
    text.slice(-half)
  );
}

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.status(200).json({
    service: "AI Infrastructure Troubleshooting Agent",
    version: "1.2.0",
    status: "operational",
    endpoints: {
      health: "GET /healthz",
      auth: "POST /auth/login",
      chat: "POST /api/chat",
      settings: "GET/PUT /api/settings",
      scripts: "GET/POST/DELETE /api/scripts"
    }
  });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/* =========================
   AUTH: LOGIN
========================= */
app.post("/auth/login", async (req, res) => {
  try {
    const adminUser = requireEnv("ADMIN_USERNAME");
    const adminPassHash = requireEnv("ADMIN_PASSWORD_HASH");

    const { username, password } = req.body || {};
    
    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: "Username and password are required"
      });
    }

    // Verify username
    const userOk = String(username).trim() === String(adminUser).trim();
    
    // Verify password using async compare (secure)
    const passOk = userOk ? await bcrypt.compare(String(password), adminPassHash) : false;

    if (!userOk || !passOk) {
      // Add small delay to prevent timing attacks
      await new Promise((resolve) => setTimeout(resolve, 500));
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials"
      });
    }

    const token = issueToken(username);
    
    return res.json({
      ok: true,
      token,
      expiresIn: "8h"
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error"
    });
  }
});

/* =========================
   SETTINGS API
========================= */
app.get("/api/settings", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const all = await readJsonFile(SETTINGS_PATH);
    const userSettings = sanitizeSettings(all[username] || {});
    
    return res.json({ ok: true, settings: userSettings });
  } catch (err) {
    console.error("GET settings error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load settings"
    });
  }
});

app.put("/api/settings", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const incoming = req.body?.settings ? req.body.settings : req.body;
    const next = sanitizeSettings(incoming);

    const all = await readJsonFile(SETTINGS_PATH);
    all[username] = next;
    await writeJsonFileAtomic(SETTINGS_PATH, all);

    return res.json({ ok: true, settings: next });
  } catch (err) {
    console.error("PUT settings error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to save settings"
    });
  }
});

/* =========================
   SCRIPT LIBRARY API
========================= */

/**
 * POST /api/scripts
 * Upload a new script file
 */
app.post("/api/scripts", authMiddleware, uploadScript.single("file"), async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const originalName = String(req.file.originalname || "script.txt");
    const contentText = safeTextFromBuffer(req.file.buffer);

    const name = String(req.body?.name || "").trim() || originalName;
    const language = String(req.body?.language || "").trim() || detectLanguageByExt(originalName);
    const tags = normalizeTags(req.body?.tags);

    const now = new Date().toISOString();
    const id = newId();

    const meta = {
      id,
      name,
      originalName,
      language,
      tags,
      size: contentText.length,
      createdAt: now,
      updatedAt: now
    };

    const saved = await saveScript(username, meta, contentText);
    
    return res.json({
      ok: true,
      script: saved.meta,
      message: "Script uploaded successfully"
    });
  } catch (err) {
    console.error("Upload script error:", err);
    return res.status(400).json({
      ok: false,
      error: err?.message || "Upload failed"
    });
  }
});

/**
 * GET /api/scripts
 * List all scripts for the authenticated user
 */
app.get("/api/scripts", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const scripts = await listScripts(username);
    
    return res.json({
      ok: true,
      scripts,
      count: scripts.length
    });
  } catch (err) {
    console.error("List scripts error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to list scripts"
    });
  }
});

/**
 * GET /api/scripts/:id
 * Get a specific script by ID
 */
app.get("/api/scripts/:id", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const scriptId = String(req.params.id || "").trim();
    if (!scriptId) {
      return res.status(400).json({ ok: false, error: "Missing script ID" });
    }

    const script = await getScript(username, scriptId);
    if (!script) {
      return res.status(404).json({ ok: false, error: "Script not found" });
    }

    return res.json({
      ok: true,
      script: script.meta,
      content: script.content
    });
  } catch (err) {
    console.error("Get script error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to retrieve script"
    });
  }
});

/**
 * DELETE /api/scripts/:id
 * Delete a script by ID
 */
app.delete("/api/scripts/:id", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const scriptId = String(req.params.id || "").trim();
    if (!scriptId) {
      return res.status(400).json({ ok: false, error: "Missing script ID" });
    }

    const deleted = await deleteScript(username, scriptId);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Script not found" });
    }

    return res.json({
      ok: true,
      message: "Script deleted successfully"
    });
  } catch (err) {
    console.error("Delete script error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to delete script"
    });
  }
});

/* =========================
   CHAT API (with image support)
========================= */
app.post("/api/chat", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "OpenAI API key not configured on server"
      });
    }

    const message = req.body?.message ? String(req.body.message) : "";
    if (!message.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Message is required"
      });
    }

    const username = userKey(req);

    // Parse selected script IDs
    let selectedScriptIds = [];
    try {
      const raw = req.body?.selectedScriptIds;
      if (raw) {
        selectedScriptIds = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
      if (!Array.isArray(selectedScriptIds)) {
        selectedScriptIds = [];
      }
    } catch {
      selectedScriptIds = [];
    }

    // Load selected scripts (with truncation and line numbers)
    const scriptBlocks = [];
    const MAX_SCRIPTS = 3;
    const MAX_CHARS_PER_SCRIPT = 6000;

    for (const id of selectedScriptIds.slice(0, MAX_SCRIPTS)) {
      const sid = String(id || "").trim();
      if (!sid) continue;
      
      const script = await getScript(username, sid);
      if (!script) continue;

      const numbered = addLineNumbers(truncateText(script.content, MAX_CHARS_PER_SCRIPT));
      scriptBlocks.push(
        `--- SCRIPT: ${script.meta.name} (${script.meta.language}) ---\n${numbered}\n--- END SCRIPT ---`
      );
    }

    // Parse conversation history
    const history = normalizeHistory(parseHistory(req.body?.history));
    const approvalState = approvalStateFromMessage(message);
    const system = buildSystemPrompt(approvalState);

    // Handle image attachment
    const hasImage = !!req.file;
    let userContent = message;

    // Append scripts to message
    if (scriptBlocks.length > 0) {
      userContent += `\n\n[ATTACHED SCRIPTS]\n${scriptBlocks.join("\n\n")}`;
    }

    // Build messages array
    const messages = [
      { role: "system", content: system },
      ...history
    ];

    // Add user message with optional image
    if (hasImage) {
      const base64Image = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype || "image/jpeg";
      
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userContent },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high"
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: userContent
      });
    }

    // Call OpenAI API with correct format
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using correct model name
      messages: messages,
      temperature: 0.7,
      max_tokens: 3000,
      top_p: 0.95
    });

    const responseText = response.choices[0]?.message?.content || "";

    if (!responseText) {
      return res.status(500).json({
        ok: false,
        error: "No response generated from AI"
      });
    }

    return res.json({
      ok: true,
      text: responseText,
      model: response.model,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      }
    });
  } catch (err) {
    console.error("Chat error:", err);
    
    // Provide specific error messages
    let errorMessage = "Internal server error";
    if (err.response?.status === 401) {
      errorMessage = "OpenAI API authentication failed";
    } else if (err.response?.status === 429) {
      errorMessage = "Rate limit exceeded. Please try again later.";
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    return res.status(500).json({
      ok: false,
      error: errorMessage
    });
  }
});

/* =========================
   ERROR HANDLING
========================= */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    ok: false,
    error: err.message || "Internal server error"
  });
});

/* =========================
   SERVER START
========================= */
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  AI Infrastructure Troubleshooting Agent                   ║
║  Server: http://localhost:${PORT}                          ║
║  Status: Ready                                             ║
╚════════════════════════════════════════════════════════════╝
  `);
});
