(function () {
  const toast = document.getElementById("toast");
  const themeToggle = document.getElementById("themeToggle");
  const copyAgentLinkBtn = document.getElementById("copyAgentLink");
  const copyAgentLinkQuickBtn = document.getElementById("copyAgentLinkQuick");
  const backToTop = document.getElementById("backToTop");

  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");

  // Prompt UX
  const promptSearch = document.getElementById("promptSearch");
  const promptGrid = document.getElementById("promptGrid");
  const emptyState = document.getElementById("emptyState");
  const filterChips = document.querySelectorAll(".chip");

  // Single source of truth
  const AGENT_URL =
    "https://chatgpt.com/g/g-69441b1b5d0c81918300df5e63b0e079-ai-infrastructure-troubleshooting-agent";

  // Theme init
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

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
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

  // Copy agent link (Hero)
  if (copyAgentLinkBtn) {
    copyAgentLinkBtn.addEventListener("click", async () => {
      const ok = await copyText(AGENT_URL);
      showToast(ok ? "Agent link copied." : "Copy failed.");
    });
  }

  // Copy agent link (Quickbar)
  if (copyAgentLinkQuickBtn) {
    copyAgentLinkQuickBtn.addEventListener("click", async () => {
      const ok = await copyText(AGENT_URL);
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

  // Mobile nav toggle
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Close menu when clicking a nav link
    mainNav.querySelectorAll("a[href^='#']").forEach((a) => {
      a.addEventListener("click", () => {
        if (mainNav.classList.contains("open")) {
          mainNav.classList.remove("open");
          navToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  // Active nav highlight (intersection observer)
  const sections = ["capabilities", "workflow", "prompts", "faq"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const navLinks = Array.from(document.querySelectorAll(".nav a[data-nav]"));
  const linkById = new Map(navLinks.map((a) => [a.dataset.nav, a]));

  if ("IntersectionObserver" in window && sections.length) {
    const io = new IntersectionObserver(
      (entries) => {
        // find most visible entry
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        navLinks.forEach((a) => a.classList.remove("active"));
        const id = visible.target.id;
        const link = linkById.get(id);
        if (link) link.classList.add("active");
      },
      { root: null, threshold: [0.2, 0.35, 0.5, 0.65] }
    );

    sections.forEach((s) => io.observe(s));
  }

  // Back to top button
  function onScroll() {
    if (!backToTop) return;
    const show = window.scrollY > 700;
    backToTop.hidden = !show;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Prompt filtering
  let activeFilter = "all";

  function getPromptCards() {
    return Array.from(promptGrid ? promptGrid.querySelectorAll(".prompt-card") : []);
  }

  function applyPromptFilters() {
    const q = (promptSearch?.value || "").trim().toLowerCase();
    const cards = getPromptCards();

    let visibleCount = 0;

    cards.forEach((card) => {
      const cat = (card.getAttribute("data-category") || "").toLowerCase();
      const keywords = (card.getAttribute("data-keywords") || "").toLowerCase();
      const text = (card.innerText || "").toLowerCase();

      const matchesFilter = activeFilter === "all" || cat === activeFilter;
      const matchesQuery = !q || keywords.includes(q) || text.includes(q);

      const show = matchesFilter && matchesQuery;
      card.style.display = show ? "" : "none";
      if (show) visibleCount += 1;
    });

    if (emptyState) emptyState.hidden = visibleCount !== 0;
  }

  if (promptSearch) {
    promptSearch.addEventListener("input", applyPromptFilters);
  }

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.getAttribute("data-filter") || "all";
      applyPromptFilters();
    });
  });

  // Initial filter pass
  applyPromptFilters();
})();
