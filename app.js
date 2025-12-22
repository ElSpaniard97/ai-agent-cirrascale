const APP_NAME = "Infra Troubleshooting Agent";

const TOKEN_KEY = "ai_agent_token";
const SETTINGS_CACHE_KEY = "ai_agent_settings_cache_v2";
const SELECTED_SCRIPTS_KEY = "ai_agent_selected_scripts_v1";

// DOM elements
const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");

const loginForm = document.getElementById("loginForm");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const authStatus = document.getElementById("authStatus");
const logoutBtn = document.getElementById("logoutBtn");

const chatEl = document.getElementById("chat");
const form = document.getElementById("form");
const messageEl = document.getElementById("message");
const imageEl = document.getElementById("image");
const sendBtn = document.getElementById("sendBtn");

const approveToggle = document.getElementById("approveToggle");
const modePill = document.getElementById("modePill");

const copyTicketBtn = document.getElementById("copyTicketBtn");
const exportTxtBtn = document.getElementById("exportTxtBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");

const toastEl = document.getElementById("toast");

const history = [];

/* =========================
   UTILITY FUNCTIONS
========================= */
function toast(msg, duration = 2500) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), duration);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

function backendBaseUrl() {
  if (!window.BACKEND_URL) return "";
  return window.BACKEND_URL.replace(/\/api\/chat\/?$/, "");
}

/* =========================
   SETTINGS MANAGEMENT
========================= */
function defaultSettings() {
  return {
    defaultPreset: "",
    expandOnPreset: true,
    rememberApproval: true,
    defaultApproval: false,
    theme: "system"
  };
}

function loadCachedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

function cacheSettings(s) {
  localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s));
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  if (theme === "light") root.setAttribute("data-theme", "light");
}

async function apiGetSettings() {
  const base = backendBaseUrl();
  const token = getToken();
  if (!base || !token) throw new Error("Missing backend URL or token");

  const resp = await fetch(`${base}/api/settings`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await resp.json().catch(() => ({}));
  if (resp.status === 401) throw new Error("unauthorized");
  if (!resp.ok || !data.ok) throw new Error(data.error || "Failed to load settings");
  return data.settings;
}

async function apiSaveSettings(settings) {
  const base = backendBaseUrl();
  const token = getToken();
  if (!base || !token) throw new Error("Missing backend URL or token");

  const resp = await fetch(`${base}/api/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ settings })
  });

  const data = await resp.json().catch(() => ({}));
  if (resp.status === 401) throw new Error("unauthorized");
  if (!resp.ok || !data.ok) throw new Error(data.error || "Failed to save settings");
  return data.settings;
}

function isApproved() {
  return !!approveToggle?.checked;
}

function setModePill() {
  if (!modePill) return;
  if (isApproved()) {
    modePill.textContent = "Mode: Remediation (Approved)";
    modePill.classList.add("danger");
  } else {
    modePill.textContent = "Mode: Diagnostics";
    modePill.classList.remove("danger");
  }
}

function applySettingsToUI(s) {
  applyTheme(s.theme);
  if (approveToggle) approveToggle.checked = !!s.defaultApproval;
  setModePill();
  if (s.defaultPreset) {
    presetFill(s.defaultPreset, { 
      focus: false, 
      expand: !!s.expandOnPreset, 
      silent: true 
    });
  }
}

/* =========================
   SELECTED SCRIPTS (local storage)
========================= */
function getSelectedScriptIds() {
  try {
    const raw = localStorage.getItem(SELECTED_SCRIPTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function setSelectedScriptIds(ids) {
  const clean = Array.isArray(ids) 
    ? ids.map(String).filter(Boolean).slice(0, 3) 
    : [];
  localStorage.setItem(SELECTED_SCRIPTS_KEY, JSON.stringify(clean));
  return clean;
}

/* =========================
   MODAL STYLES INJECTION
========================= */
function injectModalCssOnce() {
  if (document.getElementById("scriptModalCss")) return;
  
  const style = document.createElement("style");
  style.id = "scriptModalCss";
  style.textContent = `
    .modal.hidden { display: none !important; }
    .modal { 
      position: fixed; 
      inset: 0; 
      display: grid; 
      place-items: center; 
      z-index: 60; 
    }
    .modalBackdrop { 
      position: absolute; 
      inset: 0; 
      background: rgba(0,0,0,.65); 
      backdrop-filter: blur(2px);
    }
    .modalCard { 
      position: relative; 
      width: min(860px, 92vw); 
      max-height: 86vh; 
      overflow: auto;
      border-radius: 16px; 
      padding: 14px; 
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(20,28,48,.95); 
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 60px rgba(0,0,0,.5);
    }
    html[data-theme="light"] .modalCard { 
      background: rgba(255,255,255,.96); 
      color: rgba(10,20,40,.92); 
      border: 1px solid rgba(10,20,40,.12); 
    }
    .modalHeader { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      gap: 12px; 
      padding-bottom: 10px; 
      border-bottom: 1px solid rgba(255,255,255,.10); 
    }
    html[data-theme="light"] .modalHeader { 
      border-bottom: 1px solid rgba(10,20,40,.10); 
    }
    .modalTitle { 
      font-weight: 900; 
      font-size: 16px; 
    }
    .modalSubtitle { 
      opacity: .75; 
      font-size: 12px; 
      margin-top: 4px; 
    }
    .modalBody { 
      padding-top: 12px; 
      display: grid; 
      gap: 12px; 
    }
    .field { 
      display: grid; 
      gap: 6px; 
    }
    .fieldLabel { 
      font-size: 12px; 
      opacity: .75; 
      font-weight: 800; 
    }
    .row2 { 
      display: grid; 
      gap: 10px; 
      grid-template-columns: 1fr 1fr; 
    }
    @media (max-width: 740px) { 
      .row2 { 
        grid-template-columns: 1fr; 
      } 
    }
    .scriptList { 
      display: grid; 
      gap: 10px; 
    }
    .scriptItem { 
      display: flex; 
      justify-content: space-between; 
      gap: 10px; 
      align-items: center;
      padding: 10px; 
      border-radius: 12px; 
      border: 1px solid rgba(255,255,255,.12); 
      background: rgba(0,0,0,.12);
      transition: background 0.2s ease;
    }
    .scriptItem:hover {
      background: rgba(0,0,0,.18);
    }
    html[data-theme="light"] .scriptItem { 
      border: 1px solid rgba(10,20,40,.12); 
      background: rgba(10,20,40,.04); 
    }
    html[data-theme="light"] .scriptItem:hover { 
      background: rgba(10,20,40,.08); 
    }
    .scriptMeta { 
      display: grid; 
      gap: 2px; 
      flex: 1;
    }
    .scriptName { 
      font-weight: 900; 
    }
    .scriptSub { 
      font-size: 12px; 
      opacity: .78; 
    }
    .scriptActions { 
      display: flex; 
      gap: 8px; 
      align-items: center; 
      flex-wrap: wrap; 
    }
    .badge { 
      font-size: 11px; 
      padding: 4px 8px; 
      border-radius: 999px; 
      border: 1px solid rgba(255,255,255,.14); 
      opacity: .9; 
      font-weight: 700;
    }
    html[data-theme="light"] .badge { 
      border: 1px solid rgba(10,20,40,.14); 
    }
  `;
  document.head.appendChild(style);
}

/* =========================
   SCRIPT API CALLS
========================= */
async function apiListScripts() {
  const base = backendBaseUrl();
  const token = getToken();
  
  const resp = await fetch(`${base}/api/scripts`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const data = await resp.json().catch(() => ({}));
  if (resp.status === 401) throw new Error("unauthorized");
  if (!resp.ok || !data.ok) throw new Error(data.error || "Failed to list scripts");
  return data.scripts || [];
}

async function apiUploadScript({ file, name, language, tags }) {
  const base = backendBaseUrl();
  const token = getToken();

  const fd = new FormData();
  fd.append("file", file);
  if (name) fd.append("name", name);
  if (language) fd.append("language", language);
  if (tags) fd.append("tags", tags);

  const resp = await fetch(`${base}/api/scripts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd
  });

  const data = await resp.json().catch(() => ({}));
  if (resp.status === 401) throw new Error("unauthorized");
  if (!resp.ok || !data.ok) throw new Error(data.error || "Upload failed");
  return data.script;
}

async function apiDeleteScript(id) {
  const base = backendBaseUrl();
  const token = getToken();

  const resp = await fetch(`${base}/api/scripts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await resp.json().catch(() => ({}));
  if (resp.status === 401) throw new Error("unauthorized");
  if (!resp.ok || !data.ok) throw new Error(data.error || "Delete failed");
  return true;
}

/* =========================
   UTILITY BUTTONS & MODALS
========================= */
function ensureUtilityButtons() {
  const controlsLeft = document.querySelector(".controls .left");
  const controlsRight = document.querySelector(".controls .right");
  if (!controlsLeft || !controlsRight) return;

  // Clear button
  if (!document.getElementById("clearChatBtn")) {
    const clearBtn = document.createElement("button");
    clearBtn.id = "clearChatBtn";
    clearBtn.type = "button";
    clearBtn.className = "btn secondary";
    clearBtn.textContent = "Clear";
    clearBtn.title = "Clear conversation history";
    clearBtn.addEventListener("click", () => clearConversation(true));
    controlsRight.prepend(clearBtn);
  }

  // Scripts button
  if (!document.getElementById("scriptsBtn")) {
    const scriptsBtn = document.createElement("button");
    scriptsBtn.id = "scriptsBtn";
    scriptsBtn.type = "button";
    scriptsBtn.className = "btn secondary";
    scriptsBtn.textContent = "Scripts";
    scriptsBtn.title = "Upload and manage saved scripts";
    scriptsBtn.addEventListener("click", () => openScriptsModal());
    controlsLeft.appendChild(scriptsBtn);
  }

  // Settings button
  if (!document.getElementById("settingsBtn")) {
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "settingsBtn";
    settingsBtn.type = "button";
    settingsBtn.className = "btn secondary";
    settingsBtn.textContent = "Settings";
    settingsBtn.title = "Configure application settings";
    settingsBtn.addEventListener("click", () => openSettingsModal());
    controlsLeft.appendChild(settingsBtn);
  }

  injectModalCssOnce();
  ensureSettingsModal();
  ensureScriptsModal();
}

/* =========================
   SETTINGS MODAL
========================= */
function ensureSettingsModal() {
  if (document.getElementById("settingsModal")) return;

  const modal = document.createElement("div");
  modal.id = "settingsModal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modalBackdrop" data-close="1"></div>
    <div class="modalCard" role="dialog" aria-modal="true" aria-label="Settings">
      <div class="modalHeader">
        <div>
          <div class="modalTitle">Settings</div>
          <div class="modalSubtitle">Saved to your account (server-side) for future sessions.</div>
        </div>
        <button class="btn secondary" type="button" data-close="1">Close</button>
      </div>

      <div class="modalBody">
        <label class="field">
          <span class="fieldLabel">Theme</span>
          <select class="input" id="settingTheme">
            <option value="system">System (Auto)</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label class="field">
          <span class="fieldLabel">Default preset template</span>
          <select class="input" id="settingDefaultPreset">
            <option value="">None</option>
            <option value="network">Network</option>
            <option value="server">Server</option>
            <option value="script">Script</option>
            <option value="hardware">Hardware</option>
          </select>
        </label>

        <label class="field">
          <span class="fieldLabel">Auto-expand message box on preset</span>
          <select class="input" id="settingExpandOnPreset">
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>

        <label class="field">
          <span class="fieldLabel">Default remediation toggle state</span>
          <select class="input" id="settingDefaultApproval">
            <option value="false">OFF (Diagnostics only)</option>
            <option value="true">ON (Remediation approved)</option>
          </select>
        </label>

        <div style="display:flex; justify-content:flex-end; gap:10px; padding-top:8px;">
          <button class="btn secondary" type="button" id="resetSettingsBtn">Reset to Defaults</button>
          <button class="btn primary" type="button" id="saveSettingsBtn">Save Settings</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target?.getAttribute?.("data-close") === "1") {
      closeSettingsModal();
    }
  });

  wireSettingsModalButtons();
}

function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  const s = loadCachedSettings();
  document.getElementById("settingTheme").value = s.theme || "system";
  document.getElementById("settingDefaultPreset").value = s.defaultPreset || "";
  document.getElementById("settingExpandOnPreset").value = String(!!s.expandOnPreset);
  document.getElementById("settingDefaultApproval").value = String(!!s.defaultApproval);

  modal.classList.remove("hidden");
}

function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.classList.add("hidden");
}

function wireSettingsModalButtons() {
  const saveBtn = document.getElementById("saveSettingsBtn");
  const resetBtn = document.getElementById("resetSettingsBtn");

  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        
        const next = {
          theme: document.getElementById("settingTheme").value,
          defaultPreset: document.getElementById("settingDefaultPreset").value,
          expandOnPreset: document.getElementById("settingExpandOnPreset").value === "true",
          defaultApproval: document.getElementById("settingDefaultApproval").value === "true",
          rememberApproval: true
        };

        // Optimistic update
        cacheSettings({ ...defaultSettings(), ...next });
        applySettingsToUI(loadCachedSettings());

        // Persist to server
        const saved = await apiSaveSettings(next);
        cacheSettings({ ...defaultSettings(), ...saved });
        applySettingsToUI(loadCachedSettings());

        closeSettingsModal();
        toast("Settings saved successfully");
      } catch (err) {
        if (String(err?.message) === "unauthorized") {
          return forceLogout("Session expired. Please sign in again.");
        }
        toast(err?.message || "Failed to save settings", 3000);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Settings";
      }
    });
  }

  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = "1";
    resetBtn.addEventListener("click", async () => {
      try {
        resetBtn.disabled = true;
        resetBtn.textContent = "Resetting...";
        
        const reset = defaultSettings();
        cacheSettings(reset);
        applySettingsToUI(reset);

        const saved = await apiSaveSettings(reset);
        cacheSettings({ ...defaultSettings(), ...saved });
        applySettingsToUI(loadCachedSettings());

        closeSettingsModal();
        toast("Settings reset to defaults");
      } catch (err) {
        if (String(err?.message) === "unauthorized") {
          return forceLogout("Session expired. Please sign in again.");
        }
        toast(err?.message || "Failed to reset settings", 3000);
      } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = "Reset to Defaults";
      }
    });
  }
}

/* =========================
   SCRIPTS MODAL
========================= */
function ensureScriptsModal() {
  if (document.getElementById("scriptsModal")) return;

  const modal = document.createElement("div");
  modal.id = "scriptsModal";
  modal.className = "modal hidden";
  modal.innerHTML = `
    <div class="modalBackdrop" data-close="1"></div>
    <div class="modalCard" role="dialog" aria-modal="true" aria-label="Scripts">
      <div class="modalHeader">
        <div>
          <div class="modalTitle">Script Library</div>
          <div class="modalSubtitle">Upload scripts and select up to 3 to attach for troubleshooting analysis.</div>
        </div>
        <button class="btn secondary" type="button" data-close="1">Close</button>
      </div>

      <div class="modalBody">
        <div class="row2">
          <label class="field">
            <span class="fieldLabel">Script file (text only)</span>
            <input class="input" type="file" id="scriptFile" accept=".txt,.ps1,.py,.sh,.bash,.yaml,.yml,.json,.tf,.hcl,.js,.ts" />
          </label>

          <label class="field">
            <span class="fieldLabel">Display name (optional)</span>
            <input class="input" id="scriptName" placeholder="e.g., Deploy-Agent.ps1" />
          </label>
        </div>

        <div class="row2">
          <label class="field">
            <span class="fieldLabel">Language (optional, auto-detected)</span>
            <input class="input" id="scriptLang" placeholder="PowerShell, Python, Bash..." />
          </label>

          <label class="field">
            <span class="fieldLabel">Tags (comma-separated)</span>
            <input class="input" id="scriptTags" placeholder="deploy, network, firewall" />
          </label>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn secondary" type="button" id="refreshScriptsBtn">Refresh</button>
          <button class="btn primary" type="button" id="uploadScriptBtn">Upload Script</button>
        </div>

        <div class="field">
          <span class="fieldLabel">Currently selected scripts (attached to chat)</span>
          <div id="selectedScriptsRow" style="display:flex; gap:8px; flex-wrap:wrap; min-height:32px;"></div>
        </div>

        <div class="field">
          <span class="fieldLabel">Your saved scripts</span>
          <div id="scriptList" class="scriptList"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target?.getAttribute?.("data-close") === "1") {
      closeScriptsModal();
    }
  });

  wireScriptsModalButtons();
}

function openScriptsModal() {
  const modal = document.getElementById("scriptsModal");
  if (!modal) return;
  
  modal.classList.remove("hidden");
  renderSelectedScriptsRow();
  refreshScriptsList();
}

function closeScriptsModal() {
  const modal = document.getElementById("scriptsModal");
  if (modal) modal.classList.add("hidden");
}

function wireScriptsModalButtons() {
  const uploadBtn = document.getElementById("uploadScriptBtn");
  const refreshBtn = document.getElementById("refreshScriptsBtn");

  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "1";
    refreshBtn.addEventListener("click", refreshScriptsList);
  }

  if (uploadBtn && !uploadBtn.dataset.bound) {
    uploadBtn.dataset.bound = "1";
    uploadBtn.addEventListener("click", async () => {
      try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploading...";
        
        const fileInput = document.getElementById("scriptFile");
        const file = fileInput?.files?.[0];
        
        if (!file) {
          toast("Please select a script file first");
          return;
        }

        const name = document.getElementById("scriptName").value.trim();
        const language = document.getElementById("scriptLang").value.trim();
        const tags = document.getElementById("scriptTags").value.trim();

        await apiUploadScript({ file, name, language, tags });
        toast("Script uploaded successfully");
        
        // Clear inputs
        fileInput.value = "";
        document.getElementById("scriptName").value = "";
        document.getElementById("scriptLang").value = "";
        document.getElementById("scriptTags").value = "";
        
        await refreshScriptsList();
      } catch (err) {
        if (String(err?.message) === "unauthorized") {
          return forceLogout("Session expired. Please sign in again.");
        }
        toast(err?.message || "Upload failed", 3000);
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload Script";
      }
    });
  }
}

async function refreshScriptsList() {
  const list = document.getElementById("scriptList");
  if (!list) return;

  list.textContent = "Loading scripts...";
  
  try {
    const scripts = await apiListScripts();
    renderScripts(scripts);
  } catch (err) {
    if (String(err?.message) === "unauthorized") {
      return forceLogout("Session expired. Please sign in again.");
    }
    list.textContent = "Failed to load scripts. Please try again.";
  }
}

function renderSelectedScriptsRow() {
  const row = document.getElementById("selectedScriptsRow");
  if (!row) return;
  
  row.innerHTML = "";

  const ids = getSelectedScriptIds();
  
  if (!ids.length) {
    const empty = document.createElement("span");
    empty.className = "badge";
    empty.textContent = "No scripts selected";
    empty.style.opacity = "0.6";
    row.appendChild(empty);
    return;
  }

  ids.forEach((id) => {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = `📎 ${id.substring(0, 8)}...`;
    b.title = `Script ID: ${id}`;
    row.appendChild(b);
  });
}

function renderScripts(scripts) {
  const list = document.getElementById("scriptList");
  if (!list) return;
  
  list.innerHTML = "";

  const selected = new Set(getSelectedScriptIds());

  if (!scripts.length) {
    const empty = document.createElement("div");
    empty.className = "scriptItem";
    empty.style.opacity = "0.7";
    empty.textContent = "No scripts uploaded yet. Upload your first script above.";
    list.appendChild(empty);
    return;
  }

  scripts.forEach((s) => {
    const item = document.createElement("div");
    item.className = "scriptItem";

    const meta = document.createElement("div");
    meta.className = "scriptMeta";

    const name = document.createElement("div");
    name.className = "scriptName";
    name.textContent = s.name || s.originalName || s.id;

    const sub = document.createElement("div");
    sub.className = "scriptSub";
    const tags = Array.isArray(s.tags) && s.tags.length 
      ? ` • tags: ${s.tags.join(", ")}` 
      : "";
    sub.textContent = `${s.language || "Text"} • ${s.size || 0} chars${tags}`;

    meta.appendChild(name);
    meta.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "scriptActions";

    const isSelected = selected.has(s.id);

    // Select button
    const selectBtn = document.createElement("button");
    selectBtn.className = "btn secondary";
    selectBtn.type = "button";
    selectBtn.textContent = isSelected ? "✓ Selected" : "Select";
    selectBtn.disabled = isSelected;
    selectBtn.addEventListener("click", () => {
      const ids = getSelectedScriptIds();
      if (ids.includes(s.id)) return;
      if (ids.length >= 3) {
        toast("Maximum 3 scripts can be attached", 2500);
        return;
      }
      setSelectedScriptIds([...ids, s.id]);
      toast("Script attached to chat");
      renderSelectedScriptsRow();
      refreshScriptsList();
    });

    // Detach button
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn secondary";
    removeBtn.type = "button";
    removeBtn.textContent = "Detach";
    removeBtn.style.display = isSelected ? "inline-block" : "none";
    removeBtn.addEventListener("click", () => {
      const ids = getSelectedScriptIds().filter((x) => x !== s.id);
      setSelectedScriptIds(ids);
      toast("Script detached");
      renderSelectedScriptsRow();
      refreshScriptsList();
    });

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "btn secondary";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete script "${s.name || s.id}"?`)) return;
      
      try {
        await apiDeleteScript(s.id);
        
        // Also detach if selected
        const ids = getSelectedScriptIds().filter((x) => x !== s.id);
        setSelectedScriptIds(ids);
        
        toast("Script deleted");
        renderSelectedScriptsRow();
        refreshScriptsList();
      } catch (err) {
        if (String(err?.message) === "unauthorized") {
          return forceLogout("Session expired. Please sign in again.");
        }
        toast(err?.message || "Delete failed", 3000);
      }
    });

    actions.appendChild(selectBtn);
    actions.appendChild(removeBtn);
    actions.appendChild(delBtn);

    item.appendChild(meta);
    item.appendChild(actions);
    list.appendChild(item);
  });

  renderSelectedScriptsRow();
}

/* =========================
   AUTHENTICATION UI
========================= */
function setAuthUI() {
  const authed = !!getToken();
  loginScreen?.classList.toggle("hidden", authed);
  appShell?.classList.toggle("hidden", !authed);
  if (authStatus) authStatus.textContent = "";
  if (authed) ensureUtilityButtons();
}

function forceLogout(msg) {
  setToken("");
  clearConversation(false);
  setAuthUI();
  toast(msg || "Logged out", 3000);
}

/* =========================
   CONVERSATION MANAGEMENT
========================= */
function clearConversation(showToast) {
  history.length = 0;
  if (chatEl) chatEl.innerHTML = "";
  if (messageEl) messageEl.value = "";
  if (imageEl) imageEl.value = "";
  if (approveToggle) approveToggle.checked = false;
  setModePill();
  if (showToast) toast("Conversation cleared");
}

/* =========================
   CHAT HELPERS
========================= */
function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function lastAssistantText() {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") {
      return history[i].content || "";
    }
  }
  return "";
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function makeTicketNotes(text) {
  const ts = new Date().toISOString();
  return [
    `Ticket Notes (AI-assisted)`,
    `Timestamp: ${ts}`,
    `Tool: ${APP_NAME}`,
    `Mode: ${isApproved() ? "Remediation Approved" : "Diagnostics Only"}`,
    ``,
    text.trim()
  ].join("\n");
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
   EVENT LISTENERS: Buttons
========================= */
approveToggle?.addEventListener("change", () => setModePill());

copyTicketBtn?.addEventListener("click", async () => {
  const last = lastAssistantText();
  if (!last) {
    toast("No response to copy yet");
    return;
  }
  try {
    await copyToClipboard(makeTicketNotes(last));
    toast("Ticket notes copied to clipboard");
  } catch {
    toast("Copy failed (check browser permissions)", 3000);
  }
});

exportTxtBtn?.addEventListener("click", () => {
  const lines = history.map((t) => {
    const label = t.role === "user" ? "USER" : "ASSISTANT";
    return `=== ${label} ===\n${(t.content || "").trim()}\n`;
  });
  downloadFile("chat-export.txt", lines.join("\n"), "text/plain");
  toast("Chat exported as TXT");
});

exportJsonBtn?.addEventListener("click", () => {
  const payload = {
    exported_at: new Date().toISOString(),
    tool: APP_NAME,
    mode: isApproved() ? "remediation_approved" : "diagnostics_only",
    history,
    selectedScriptIds: getSelectedScriptIds()
  };
  downloadFile("chat-export.json", JSON.stringify(payload, null, 2), "application/json");
  toast("Chat exported as JSON");
});

/* =========================
   PRESETS
========================= */
const presets = {
  network: `Category: Networking (Switch/Router)
Goal: Diagnostics only (no changes)

Environment:
- Vendor/Model:
- OS/Version:
- Topology/Role:

Symptoms:
- What changed? (time, deploy, config, cabling)
- Impact scope (# users/services, VLANs, sites)

Evidence (paste outputs):
- show interface status
- show interface counters
- show log | last 50
- show spanning-tree
- show ip route
- traceroute/ping results

What you need:
- Root cause hypothesis + verification steps`,

  server: `Category: Server OS / Services
Goal: Diagnostics only (no changes)

Environment:
- OS (Linux/Windows):
- Host role/service:
- Recent changes (patch, deploy, config):

Symptoms:
- CPU/memory/disk?
- Service down? errors?
- Scope/impact:

Evidence (paste outputs/logs):
- Linux: top/htop, df -h, free -m, journalctl -u <svc>, ss -tulpn
- Windows: Event Viewer errors, Get-Service, Get-Process, perf counters

What you need:
- Likely causes ranked + verification commands + what to look for`,

  script: `Category: Script / Automation
Goal: Fix explanation + corrected snippet (no destructive steps unless approved)

Language/tool:
- PowerShell / Python / Bash / Ansible / Terraform / YAML/JSON

Input:
- Paste full error/traceback/logs
- Paste script (or minimal reproducible snippet)

Context:
- What should it do?
- What environment (OS, versions)?
- Any secrets redacted?

What you need:
- Root cause + corrected code + validation steps`,

  hardware: `Category: Hardware / Components
Goal: Diagnostics only (no changes)

Platform:
- Vendor (Dell/iDRAC, HPE/iLO, Supermicro/IPMI):
- Model:
- Alert codes / LEDs / logs:

Symptoms:
- Power/PSU?
- Thermals/fans?
- Storage/RAID?
- Memory/ECC?

Evidence:
- Screenshot of alert
- SEL / lifecycle logs / iLO logs
- Recent changes (firmware, component swap)

What you need:
- Likely cause + checks + safe remediation plan (approval-gated)`
};

function expandMessageBox() {
  if (!messageEl) return;
  messageEl.classList.add("expanded");
  messageEl.rows = 10;
}

function presetFill(key, opts = { focus: true, expand: true, silent: false }) {
  if (!presets[key] || !messageEl) return;
  messageEl.value = presets[key];
  if (opts.expand) expandMessageBox();
  if (opts.focus) messageEl.focus();
  if (!opts.silent) toast(`Loaded ${key} template`);
}

document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-preset");
    presetFill(key, { focus: true, expand: true, silent: false });
  });
});

/* =========================
   CHAT SUBMIT
========================= */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = getToken();
  if (!token) {
    toast("Please login first", 2500);
    return;
  }

  const rawMessage = (messageEl?.value || "").trim();
  if (!rawMessage) {
    toast("Please enter a message", 2000);
    return;
  }

  const approvalHeader = isApproved()
    ? "APPROVAL: APPROVED (maintenance window OK; backups OK; rollback OK)"
    : "APPROVAL: NOT APPROVED (diagnostics only)";

  const message = `${approvalHeader}\n\n${rawMessage}`;

  addBubble("user", rawMessage);
  history.push({ role: "user", content: message });

  messageEl.value = "";
  
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "Analyzing...";
  }

  const working = addBubble("assistant", "🔍 Analyzing... diagnostics in progress...");

  try {
    const fd = new FormData();
    fd.append("message", message);
    fd.append("history", JSON.stringify(history));
    fd.append("selectedScriptIds", JSON.stringify(getSelectedScriptIds()));

    if (imageEl?.files?.[0]) {
      fd.append("image", imageEl.files[0]);
    }

    const resp = await fetch(window.BACKEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });

    const data = await resp.json().catch(() => ({}));

    if (resp.status === 401) {
      return forceLogout("Session expired. Please sign in again.");
    }

    if (!resp.ok || !data.ok) {
      working.textContent = `❌ Error: ${data.error || resp.statusText}`;
      toast("Request failed", 3000);
      return;
    }

    working.textContent = data.text || "(No response text)";
    history.push({ role: "assistant", content: data.text || "" });
    toast("Response received");
  } catch (err) {
    working.textContent = `❌ Error: ${err?.message || "Request failed"}`;
    toast("Network error occurred", 3000);
  } finally {
    if (imageEl) imageEl.value = "";
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send";
    }
  }
});

/* =========================
   LOGIN / LOGOUT
========================= */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  try {
    const username = (loginUser?.value || "").trim();
    const password = (loginPass?.value || "").trim();
    
    if (!username || !password) {
      toast("Enter username and password", 2500);
      return;
    }

    if (authStatus) authStatus.textContent = "Signing in...";

    const resp = await fetch(window.LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await resp.json().catch(() => ({}));
    
    if (!resp.ok || !data.ok || !data.token) {
      if (authStatus) authStatus.textContent = "";
      toast(data.error || "Login failed", 3000);
      return;
    }

    setToken(data.token);
    loginPass.value = "";
    if (authStatus) authStatus.textContent = "";

    setAuthUI();
    ensureUtilityButtons();

    // Fetch server-side settings (non-fatal if fails)
    try {
      const s = await apiGetSettings();
      cacheSettings({ ...defaultSettings(), ...s });
      applySettingsToUI(loadCachedSettings());
    } catch {
      // Fall back to cached settings
      applySettingsToUI(loadCachedSettings());
    }

    toast(`Welcome to ${APP_NAME}`, 2500);
  } catch (err) {
    if (authStatus) authStatus.textContent = "";
    toast(err?.message || "Login error", 3000);
  }
});

logoutBtn?.addEventListener("click", () => {
  setToken("");
  clearConversation(false);
  setAuthUI();
  toast("Logged out successfully");
});

/* =========================
   KEYBOARD SHORTCUTS
========================= */
messageEl?.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + Enter to submit
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    form?.requestSubmit();
  }
});

/* =========================
   SIDEBAR TOGGLE
========================= */
function setupSidebarToggle() {
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarFloatingToggle = document.getElementById('sidebarFloatingToggle');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');

  // Desktop toggle (inside sidebar)
  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar?.classList.contains('collapsed'));
  });

  // Floating toggle (appears when collapsed)
  sidebarFloatingToggle?.addEventListener('click', () => {
    sidebar?.classList.remove('collapsed');
    localStorage.setItem('sidebarCollapsed', 'false');
  });

  // Mobile toggle
  mobileMenuBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (sidebar?.classList.contains('open') && 
          !sidebar.contains(e.target) && 
          e.target !== mobileMenuBtn) {
        sidebar.classList.remove('open');
      }
    }
  });

  // Restore sidebar state
  const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (wasCollapsed) {
    sidebar?.classList.add('collapsed');
  }
}

/* =========================
   INITIALIZATION
========================= */
setModePill();
setAuthUI();
ensureUtilityButtons();
applySettingsToUI(loadCachedSettings());
setupSidebarToggle();

console.log(`${APP_NAME} v1.2.0 initialized`);
