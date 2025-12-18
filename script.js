(function () {
  const toast = document.getElementById("toast");
  const themeToggle = document.getElementById("themeToggle");
  const copyAgentLinkBtn = document.getElementById("copyAgentLink");

  // Set initial theme from localStorage (default dark)
  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toast.classList.remove("show"), 1600);
  }

  function getAgentLink() {
    const a = document.getElementById("agentLinkHero") || document.getElementById("agentLinkTop");
    return a ? a.href : "";
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  }

  // Theme toggle
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      if (isLight) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "dark");
        showToast("Theme: Dark");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
        showToast("Theme: Light");
      }
    });
  }

  // Copy agent link
  if (copyAgentLinkBtn) {
    copyAgentLinkBtn.addEventListener("click", async () => {
      const link = getAgentLink();
      if (!link) return showToast("Agent link not found.");
      const ok = await copyText(link);
      showToast(ok ? "Agent link copied." : "Copy failed.");
    });
  }

  // Copy prompt buttons
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy") || "";
      if (!text) return showToast("Nothing to copy.");
      const ok = await copyText(text);
      showToast(ok ? "Prompt copied." : "Copy failed.");
    });
  });
})();
