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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* =========================
   CORS
========================= */
const ALLOWED_ORIGINS = new Set([
  "https://elspaniard97.github.io",
     "http://localhost:5500",
     "http://localhost:3000",
     "http://localhost:8080",
     "http://127.0.0.1:5500",
     "http://127.0.0.1:3000",
     "http://127.0.0.1:8080"
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204
  })
);

app.use(express.json({ limit: "10mb" }));

/* =========================
   MULTER
========================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 } // 6MB for screenshots/logs
});

const uploadScript = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 } // 512KB per script (adjust as needed)
});

/* =========================
   ENV + AUTH
========================= */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function issueToken(username) {
  const secret = requireEnv("JWT_SECRET");
  return jwt.sign({ sub: username }, secret, { expiresIn: "8h" });
}

function authMiddleware(req, res, next) {
  try {
    const secret = requireEnv("JWT_SECRET");
    const auth = req.headers.authorization || "";
    const [scheme, token] = auth.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const payload = jwt.verify(token, secret);
    req.user = payload; // payload.sub
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
}

/* =========================
   Settings store (optional; kept if you added it)
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

  if (typeof input.defaultPreset === "string") out.defaultPreset = input.defaultPreset;
  if (typeof input.expandOnPreset === "boolean") out.expandOnPreset = input.expandOnPreset;
  if (typeof input.rememberApproval === "boolean") out.rememberApproval = input.rememberApproval;
  if (typeof input.defaultApproval === "boolean") out.defaultApproval = input.defaultApproval;
  if (input.theme === "system" || input.theme === "dark" || input.theme === "light") out.theme = input.theme;

  const allowedPresets = new Set(["", "network", "server", "script", "hardware"]);
  if (!allowedPresets.has(out.defaultPreset)) out.defaultPreset = "";
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
  } catch {
    return {};
  }
}

async function writeJsonFileAtomic(filePath, obj) {
  await ensureDirForFile(filePath);
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

/* =========================
   SCRIPT STORAGE (Render Disk)
========================= */
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || "/data/scripts";
const SCRIPTS_INDEX_PATH = path.join(SCRIPTS_DIR, "index.json");

function userKey(req) {
  return String(req.user?.sub || "").trim();
}

function safeTextFromBuffer(buf) {
  // Basic text safety checks: reject null bytes and very binary-looking content.
  if (!Buffer.isBuffer(buf)) throw new Error("Invalid file buffer");
  if (buf.includes(0)) throw new Error("File appears to be binary (null bytes found).");

  // Decode as utf8
  const text = buf.toString("utf8");

  // Heuristic: reject extremely high ratio of replacement chars
  const replacement = (text.match(/\uFFFD/g) || []).length;
  if (replacement > 10) throw new Error("File encoding looks invalid; please upload a UTF-8 text file.");

  return text;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String).map(t => t.trim()).filter(Boolean).slice(0, 20);
  return String(tags)
    .split(",")
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function detectLanguageByExt(filename = "") {
  const ext = filename.toLowerCase().split(".").pop();
  const map = {
    ps1: "PowerShell",
    py: "Python",
    sh: "Bash",
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
    txt: "Text"
  };
  return map[ext] || "Text";
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
  // keep paths controlled and predictable
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

  // update index
  const indexObj = await readScriptsIndex();
  if (!indexObj[username]) indexObj[username] = {};
  indexObj[username][scriptId] = meta;
  await writeScriptsIndex(indexObj);

  return { id: scriptId, meta };
}

async function listScripts(username) {
  const indexObj = await readScriptsIndex();
  const byUser = indexObj[username] || {};
  return Object.values(byUser)
    .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
}

async function getScript(username, scriptId) {
  const indexObj = await readScriptsIndex();
  const meta = indexObj[username]?.[scriptId];
  if (!meta) return null;

  const folder = scriptFolder(username, scriptId);
  const scriptPath = path.join(folder, "script.txt");
  const content = await fs.readFile(scriptPath, "utf8").catch(() => null);
  if (content === null) return null;

  return { meta, content };
}

async function deleteScript(username, scriptId) {
  const indexObj = await readScriptsIndex();
  if (!indexObj[username]?.[scriptId]) return false;

  // remove folder
  const folder = scriptFolder(username, scriptId);
  await fs.rm(folder, { recursive: true, force: true });

  // update index
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
  const base = `
You are an enterprise infrastructure troubleshooting agent for:
- Networking (switches/routers)
- Server OS/services (Linux/Windows)
- Scripts/automation (PowerShell/Python/Bash/Ansible/Terraform/YAML/JSON)
- Hardware/component alerts (iDRAC/iLO/IPMI, RAID, thermals, PSU, ECC)

Operating rules:
1) Diagnostics-first: Start by clarifying scope/impact, recent change, and collecting evidence.
2) Ticket-safe output: Never request or output secrets (keys/passwords). Recommend redaction.
3) Be explicit and structured: Provide commands/steps AND "what to look for".
4) Safety: Avoid risky/production-impacting changes unless APPROVAL is confirmed.
5) If scripts are provided: reference them by NAME and cite approximate line ranges.

Approval policy:
- If approval is NOT confirmed: provide ONLY diagnostics, verification commands, decision points, and safe mitigations that do not change production configuration.
- If approval IS confirmed: provide a remediation plan with rollback + validation.

Response format (always):
A) Quick Triage (2-6 bullets)
B) Likely Causes (ranked)
C) Evidence to Collect (commands + what to look for)
D) Decision Tree / Next Steps
E) If APPROVED: Remediation Plan (change steps + rollback + validation)
`;

  return approvalState === "approved"
    ? base + "\nApproval status: APPROVED. Remediation plan is allowed if appropriate.\n"
    : base + "\nApproval status: NOT APPROVED. Diagnostics only; do NOT provide production-impacting remediation steps.\n";
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (x) =>
        x &&
        (x.role === "user" || x.role === "assistant") &&
        typeof x.content === "string"
    )
    .slice(-12)
    .map((x) => ({ role: x.role, content: x.content }));
}

function addLineNumbers(text) {
  const lines = String(text).split("\n");
  return lines.map((ln, i) => `${String(i + 1).padStart(4, " ")} | ${ln}`).join("\n");
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n[TRUNCATED: showing first ${maxChars} characters]`;
}

/* =========================
   ROUTES
========================= */
app.get("/", (req, res) => {
  res.status(200).send("Backend running. Use GET /healthz, POST /auth/login, POST /api/chat.");
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* ---- Auth Login ---- */
app.post("/auth/login", async (req, res) => {
  try {
    const adminUser = requireEnv("ADMIN_USERNAME");
    const adminPass = requireEnv("ADMIN_PASSWORD");

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "Username and password are required" });
    }

    // NOTE: This is single-admin auth. If you later add multi-user accounts,
    // replace this with a real user store.
    const passHash = bcrypt.hashSync(adminPass, 10);
    const userOk = String(username) === String(adminUser);
    const passOk = bcrypt.compareSync(String(password), passHash);

    if (!userOk || !passOk) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = issueToken(username);
    return res.json({ ok: true, token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/* ---- Settings (server-side) ---- */
app.get("/api/settings", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const all = await readJsonFile(SETTINGS_PATH);
    const userSettings = sanitizeSettings(all[username] || {});
    return res.json({ ok: true, settings: userSettings });
  } catch (err) {
    console.error("GET settings error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

app.put("/api/settings", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const incoming = req.body?.settings ? req.body.settings : req.body;
    const next = sanitizeSettings(incoming);

    const all = await readJsonFile(SETTINGS_PATH);
    all[username] = next;
    await writeJsonFileAtomic(SETTINGS_PATH, all);

    return res.json({ ok: true, settings: next });
  } catch (err) {
    console.error("PUT settings error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/* =========================
   SCRIPT LIBRARY API
========================= */

/**
 * POST /api/scripts
 * multipart/form-data:
 * - file: script file
 * - name: optional display name
 * - language: optional
 * - tags: optional "a,b,c"
 */
app.post("/api/scripts", authMiddleware, uploadScript.single("file"), async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });

    if (!req.file) return res.status(400).json({ ok: false, error: "Missing file" });

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
    return res.json({ ok: true, script: saved.meta });
  } catch (err) {
    console.error("Upload script error:", err);
    return res.status(400).json({ ok: false, error: err?.message || "Upload failed" });
  }
});

/**
 * GET /api/scripts
 */
app.get("/api/scripts", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const scripts = await listScripts(username);
    return res.json({ ok: true, scripts });
  } catch (err) {
    console.error("List scripts error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * GET /api/scripts/:id
 */
app.get("/api/scripts/:id", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const scriptId = String(req.params.id || "").trim();
    if (!scriptId) return res.status(400).json({ ok: false, error: "Missing script id" });

    const script = await getScript(username, scriptId);
    if (!script) return res.status(404).json({ ok: false, error: "Not found" });

    return res.json({ ok: true, script: script.meta, content: script.content });
  } catch (err) {
    console.error("Get script error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * DELETE /api/scripts/:id
 */
app.delete("/api/scripts/:id", authMiddleware, async (req, res) => {
  try {
    const username = userKey(req);
    if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const scriptId = String(req.params.id || "").trim();
    if (!scriptId) return res.status(400).json({ ok: false, error: "Missing script id" });

    const ok = await deleteScript(username, scriptId);
    if (!ok) return res.status(404).json({ ok: false, error: "Not found" });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete script error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/* =========================
   CHAT (now supports selectedScriptIds)
========================= */
app.post("/api/chat", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY on server." });
    }

    const message = req.body?.message ? String(req.body.message) : "";
    if (!message.trim()) return res.status(400).json({ ok: false, error: "Message is required" });

    const username = userKey(req);

    // Selected scripts passed from frontend
    let selectedScriptIds = [];
    try {
      const raw = req.body?.selectedScriptIds;
      if (raw) selectedScriptIds = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(selectedScriptIds)) selectedScriptIds = [];
    } catch {
      selectedScriptIds = [];
    }

    // Load selected scripts (truncate and add line numbers)
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
        `--- SCRIPT: ${script.meta.name} (language: ${script.meta.language}) ---\n${numbered}\n--- END SCRIPT ---`
      );
    }

    const history = normalizeHistory(parseHistory(req.body?.history));
    const approvalState = approvalStateFromMessage(message);
    const system = buildSystemPrompt(approvalState);

    const hasImage = !!req.file;

    let userContent = message;
    if (scriptBlocks.length) {
      userContent += `\n\n[Saved Scripts Attached]\n${scriptBlocks.join("\n\n")}`;
    }
    if (hasImage) {
      userContent += `\n\n[Note: User attached a screenshot image. Ask for the visible error text if needed; do not assume OCR.]`;
    }

    const messages = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: userContent }
    ];

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: messages
    });

    return res.json({ ok: true, text: response.output_text || "" });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
