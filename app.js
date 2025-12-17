const $ = (id) => document.getElementById(id);

let PLAYBOOKS = null;

async function loadPlaybooks() {
  const res = await fetch("./data/playbooks.json");
  PLAYBOOKS = await res.json();
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function scorePlaybook(item, text) {
  const t = normalize(text);
  let score = 0;
  for (const k of item.keywords || []) {
    if (t.includes(normalize(k))) score += 2;
  }
  // light heuristic bonus for common symptom terms
  if (t.includes("error")) score += 1;
  if (t.includes("fail") || t.includes("failed")) score += 1;
  return score;
}

function buildReport({ category, device, context, description, match }) {
  const lines = [];
  lines.push(`AI Troubleshooting Agent Report`);
  lines.push(`Date: ${new Date().toLocaleString()}`);
  lines.push(`Category: ${category}`);
  lines.push(`Device/OS: ${device}`);
  lines.push(`Context: ${context}`);
  lines.push(``);
  lines.push(`Problem Description:`);
  lines.push(description || "(none provided)");
  lines.push(``);
  if (!match) {
    lines.push(`No strong playbook match found. Use general triage: reproduce → scope → isolate → remediate → verify.`);
    return lines.join("\n");
  }

  lines.push(`Best Match Playbook: ${match.name}`);
  lines.push(``);
  lines.push(`Clarifying Questions:`);
  (match.questions || []).forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  lines.push(``);
  lines.push(`Recommended Steps:`);
  (match.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push(``);
  lines.push(`Suggested Commands (${device}):`);
  const cmds = (match.commands && match.commands[device]) ? match.commands[device] : [];
  if (cmds.length === 0) lines.push(`(none)`);
  cmds.forEach(c => lines.push(`- ${c}`));

  return lines.join("\n");
}

function renderKV(title, bodyHtml) {
  const div = document.createElement("div");
  div.className = "kv";
  div.innerHTML = `<b>${title}</b><div style="margin-top:6px">${bodyHtml}</div>`;
  return div;
}

function renderList(items) {
  if (!items || items.length === 0) return `<span class="muted">(none)</span>`;
  return `<ol style="margin:0; padding-left:18px">${items.map(x => `<li>${x}</li>`).join("")}</ol>`;
}

function renderCommands(cmds) {
  if (!cmds || cmds.length === 0) return `<div class="code">(none)</div>`;
  return `<div class="code">${cmds.map(c => `$ ${c}`).join("\n")}</div>`;
}

function setButtonsEnabled(enabled) {
  $("exportBtn").disabled = !enabled;
  $("copyBtn").disabled = !enabled;
}

function findBestMatch(category, description) {
  const items = (PLAYBOOKS && PLAYBOOKS[category]) ? PLAYBOOKS[category] : [];
  let best = null;
  let bestScore = 0;
  for (const it of items) {
    const s = scorePlaybook(it, description);
    if (s > bestScore) {
      best = it;
      bestScore = s;
    }
  }
  // require a minimal score to be considered a "match"
  if (bestScore < 2) return null;
  return best;
}

async function analyze() {
  const category = $("category").value;
  const device = $("device").value;
  const context = $("context").value;
  const description = $("description").value;

  const match = findBestMatch(category, description);

  // Questions panel
  $("questions").classList.remove("muted");
  $("questions").innerHTML = match
    ? renderList(match.questions)
    : `<div class="muted">No strong match yet. Add more details (exact error text, what changed, scope, and last known good).</div>`;

  // Output panel
  $("output").classList.remove("muted");
  if (!match) {
    $("output").innerHTML = `
      ${renderKV("General Triage Flow", renderList([
        "Reproduce and capture exact error text",
        "Define scope (single user/device vs widespread)",
        "Isolate layer (device, network, account, app, service)",
        "Apply least-risk fix first; document changes",
        "Verify resolution and implement prevention"
      ]))}
      ${renderKV("Next Details to Collect", renderList([
        "Timestamp of last success and first failure",
        "Network name/VPN/proxy status",
        "Screenshots/log snippets",
        "Any recent updates/changes"
      ]))}
    `;
    $("playbookHits").innerHTML = `<div class="muted">(No playbook match)</div>`;
    setButtonsEnabled(true);
    window.__LAST_REPORT__ = buildReport({ category, device, context, description, match: null });
    return;
  }

  const cmds = (match.commands && match.commands[device]) ? match.commands[device] : [];

  $("output").innerHTML = `
    ${renderKV("Diagnosis Candidate", `<span class="muted">Matched playbook:</span> ${match.name}`)}
    ${renderKV("Recommended Steps", renderList(match.steps))}
    ${renderKV("Command Snippets", renderCommands(cmds))}
  `;

  $("playbookHits").classList.remove("muted");
  $("playbookHits").innerHTML = `
    ${renderKV("Match", `${match.name}`)}
    ${renderKV("Keywords", (match.keywords || []).map(k => `<code>${k}</code>`).join(" "))}
  `;

  setButtonsEnabled(true);
  window.__LAST_REPORT__ = buildReport({ category, device, context, description, match });
}

function resetAll() {
  $("description").value = "";
  $("questions").innerHTML = `Run “Analyze” to generate questions.`;
  $("questions").classList.add("muted");
  $("output").innerHTML = `Recommendations will appear here.`;
  $("output").classList.add("muted");
  $("playbookHits").innerHTML = `Matching procedures will show here.`;
  $("playbookHits").classList.add("muted");
  setButtonsEnabled(false);
  window.__LAST_REPORT__ = "";
}

function exportReport() {
  const text = window.__LAST_REPORT__ || "";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `troubleshooting-report-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyReport() {
  const text = window.__LAST_REPORT__ || "";
  await navigator.clipboard.writeText(text);
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadPlaybooks();
  $("analyzeBtn").addEventListener("click", analyze);
  $("resetBtn").addEventListener("click", resetAll);
  $("exportBtn").addEventListener("click", exportReport);
  $("copyBtn").addEventListener("click", copyReport);
  resetAll();
});
