(() => {
  const search = document.getElementById("promptSearch");
  const grid = document.getElementById("promptGrid");
  const empty = document.getElementById("emptyState");
  const segs = Array.from(document.querySelectorAll(".seg"));

  if (!grid) return;

  let filter = "all";

  const cards = () => Array.from(grid.querySelectorAll("[data-category]"));

  const apply = () => {
    const q = (search?.value || "").trim().toLowerCase();
    let shown = 0;

    cards().forEach((c) => {
      const cat = (c.getAttribute("data-category") || "").toLowerCase();
      const kw = (c.getAttribute("data-keywords") || "").toLowerCase();
      const txt = (c.innerText || "").toLowerCase();

      const okFilter = filter === "all" || cat === filter;
      const okQuery = !q || kw.includes(q) || txt.includes(q);

      const show = okFilter && okQuery;
      c.style.display = show ? "" : "none";
      if (show) shown++;
    });

    if (empty) empty.hidden = shown !== 0;
  };

  if (search) search.addEventListener("input", apply);

  segs.forEach((s) => {
    s.addEventListener("click", () => {
      segs.forEach((x) => x.classList.remove("is-active"));
      s.classList.add("is-active");
      filter = s.getAttribute("data-filter") || "all";
      apply();
    });
  });

  apply();
})();
