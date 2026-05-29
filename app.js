/* Ledger — a private, local-first budget tracker.
   All data lives in this browser via localStorage. No server, no accounts. */

(() => {
  "use strict";

  const KEY = "ledger.data.v1";
  const DEFAULTS = {
    version: 1,
    categories: {
      expense: ["Groceries", "Rent", "Dining", "Transport", "Utilities", "Shopping", "Health", "Fun", "Other"],
      income: ["Salary", "Freelance", "Gift", "Refund", "Other"],
    },
    transactions: [],
  };

  // ---------- State ----------
  let state = load();
  let viewMonth = startOfMonth(new Date());     // Date pinned to 1st of viewed month
  let editingId = null;                          // null = creating new
  let draftType = "expense";
  let draftCategory = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      // shallow merge to tolerate older saves
      return {
        ...structuredClone(DEFAULTS),
        ...parsed,
        categories: { ...DEFAULTS.categories, ...(parsed.categories || {}) },
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      };
    } catch (e) {
      console.error("Load failed, starting fresh:", e);
      return structuredClone(DEFAULTS);
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast("Couldn't save — storage may be full or blocked.");
      console.error(e);
    }
  }

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
  function txMonthKey(t) { return t.date.slice(0, 7); } // YYYY-MM
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // New entries default to today when viewing the current month, otherwise the
  // 1st of whatever month is on screen — so logging while browsing a future
  // month pre-fills a date in that month.
  function defaultNewDate() {
    if (monthKey(viewMonth) === monthKey(startOfMonth(new Date()))) return todayISO();
    return `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}-01`;
  }

  function fmtMoney(n) {
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign}$${abs}`;
  }

  function fmtMonthLabel(d) {
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function fmtDayLabel(iso) {
    const [y, m, day] = iso.split("-").map(Number);
    const d = new Date(y, m - 1, day);
    const t = new Date(); const yest = new Date(); yest.setDate(t.getDate() - 1);
    if (iso === todayISO()) return "Today";
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let toastTimer;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // ---------- Rendering ----------
  function monthTx() {
    const k = monthKey(viewMonth);
    return state.transactions
      .filter((t) => txMonthKey(t) === k)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
  }

  function render() {
    const txs = monthTx();
    const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const net = income - expense;

    const ml = $("monthLabel");
    ml.textContent = fmtMonthLabel(viewMonth);
    const onCurrentMonth = monthKey(viewMonth) === monthKey(startOfMonth(new Date()));
    ml.classList.toggle("away", !onCurrentMonth);
    ml.title = onCurrentMonth ? "" : "Tap to jump back to this month";
    // forward navigation is always allowed so future entries can be logged & viewed
    $("nextMonth").style.visibility = "visible";

    const netEl = $("netBalance");
    netEl.textContent = fmtMoney(net);
    netEl.classList.toggle("pos", net > 0);
    netEl.classList.toggle("neg", net < 0);

    $("totalIncome").textContent = fmtMoney(income);
    $("totalExpense").textContent = fmtMoney(expense);

    renderBreakdown(txs, expense);
    renderList(txs);
  }

  function renderBreakdown(txs, totalExpense) {
    const section = $("breakdownSection");
    const list = $("breakdownList");
    const byCat = {};
    txs.filter((t) => t.type === "expense").forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    if (!entries.length || totalExpense <= 0) { section.hidden = true; list.innerHTML = ""; return; }
    section.hidden = false;
    list.innerHTML = entries.map(([cat, amt]) => {
      const pct = Math.round((amt / totalExpense) * 100);
      return `<li class="bd-row">
        <span class="bd-name">${esc(cat)}</span>
        <span class="bd-amt">${esc(fmtMoney(amt))} · ${pct}%</span>
        <span class="bd-track"><span class="bd-fill" style="width:${pct}%"></span></span>
      </li>`;
    }).join("");
  }

  function renderList(txs) {
    const wrap = $("txList");
    const empty = $("emptyState");
    wrap.innerHTML = "";

    if (!txs.length) { empty.hidden = false; return; }
    empty.hidden = true;

    let lastDay = null;
    txs.forEach((t) => {
      if (t.date !== lastDay) {
        lastDay = t.date;
        const dh = document.createElement("div");
        dh.className = "tx-day-label";
        dh.textContent = fmtDayLabel(t.date);
        wrap.appendChild(dh);
      }
      const row = document.createElement("button");
      row.className = "tx";
      row.type = "button";
      const cls = t.type === "income" ? "in" : "out";
      const glyph = t.type === "income" ? "+" : "–";
      const amtTxt = (t.type === "income" ? "+" : "−") + fmtMoney(t.amount).replace(/^-/, "");
      row.innerHTML = `
        <span class="tx-dot ${cls}">${glyph}</span>
        <span class="tx-body">
          <span class="tx-cat">${esc(t.category)}</span>
          ${t.note ? `<span class="tx-note">${esc(t.note)}</span>` : ""}
        </span>
        <span class="tx-amt ${cls}">${esc(amtTxt)}</span>`;
      row.addEventListener("click", () => openSheet(t));
      wrap.appendChild(row);
    });
  }

  // ---------- Add / edit sheet ----------
  function openSheet(tx) {
    editingId = tx ? tx.id : null;
    draftType = tx ? tx.type : "expense";
    draftCategory = tx ? tx.category : null;

    $("sheetTitle").textContent = tx ? "Edit entry" : "New entry";
    $("deleteBtn").hidden = !tx;
    $("amountInput").value = tx ? String(tx.amount) : "";
    $("noteInput").value = tx ? (tx.note || "") : "";
    $("dateInput").value = tx ? tx.date : defaultNewDate();

    setType(draftType);
    showOverlay("sheetOverlay");
    if (!tx) setTimeout(() => $("amountInput").focus(), 320);
  }

  function setType(type) {
    draftType = type;
    $("typeExpense").classList.toggle("active", type === "expense");
    $("typeIncome").classList.toggle("active", type === "income");
    // reset category if it no longer belongs to this type's list
    if (!state.categories[type].includes(draftCategory)) draftCategory = null;
    renderChips();
  }

  function renderChips() {
    const wrap = $("categoryChips");
    wrap.innerHTML = "";
    state.categories[draftType].forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (cat === draftCategory ? " active" : "");
      chip.textContent = cat;
      chip.addEventListener("click", () => { draftCategory = cat; renderChips(); });
      wrap.appendChild(chip);
    });
  }

  function saveEntry() {
    const raw = $("amountInput").value.replace(/[^0-9.]/g, "");
    const amount = Math.round(parseFloat(raw) * 100) / 100;
    if (!raw || isNaN(amount) || amount <= 0) { toast("Enter an amount greater than 0."); return; }
    if (!draftCategory) { toast("Pick a category."); return; }
    const date = $("dateInput").value || todayISO();
    const note = $("noteInput").value.trim();

    if (editingId) {
      const t = state.transactions.find((x) => x.id === editingId);
      if (t) Object.assign(t, { type: draftType, amount, category: draftCategory, date, note });
    } else {
      state.transactions.push({
        id: uid(), type: draftType, amount, category: draftCategory, date, note, createdAt: Date.now(),
      });
      // jump the view to the month we just logged into
      viewMonth = startOfMonth(new Date(date + "T00:00:00"));
    }
    save();
    closeOverlay("sheetOverlay");
    render();
    toast(editingId ? "Updated." : "Saved.");
  }

  function deleteEntry() {
    if (!editingId) return;
    state.transactions = state.transactions.filter((x) => x.id !== editingId);
    save();
    closeOverlay("sheetOverlay");
    render();
    toast("Deleted.");
  }

  // ---------- Settings ----------
  function openSettings() {
    renderCatEditor();
    showOverlay("settingsOverlay");
  }

  function renderCatEditor() {
    ["expense", "income"].forEach((type) => {
      const wrap = $(type === "expense" ? "expenseCats" : "incomeCats");
      wrap.innerHTML = "";
      state.categories[type].forEach((cat) => {
        const tag = document.createElement("span");
        tag.className = "cat-tag";
        tag.innerHTML = `${esc(cat)} <button type="button" aria-label="Remove ${esc(cat)}">✕</button>`;
        tag.querySelector("button").addEventListener("click", () => removeCat(type, cat));
        wrap.appendChild(tag);
      });
    });
  }

  function addCat(type, value) {
    const v = value.trim();
    if (!v) return;
    if (state.categories[type].some((c) => c.toLowerCase() === v.toLowerCase())) { toast("That category already exists."); return; }
    state.categories[type].push(v);
    save(); renderCatEditor();
  }

  function removeCat(type, cat) {
    const used = state.transactions.some((t) => t.type === type && t.category === cat);
    if (used && !confirm(`Some entries use "${cat}". Remove it anyway? Those entries keep the label.`)) return;
    state.categories[type] = state.categories[type].filter((c) => c !== cat);
    save(); renderCatEditor();
  }

  // ---------- Export / import ----------
  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    download(`ledger-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json");
    toast("Backup downloaded.");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.transactions)) throw new Error("Not a Ledger backup");
        if (!confirm(`Restore ${data.transactions.length} entries? This replaces everything currently on this device.`)) return;
        state = {
          ...structuredClone(DEFAULTS),
          ...data,
          categories: { ...DEFAULTS.categories, ...(data.categories || {}) },
          transactions: data.transactions,
        };
        save(); render();
        toast("Backup restored.");
        closeOverlay("settingsOverlay");
      } catch (e) {
        toast("That file isn't a valid Ledger backup.");
        console.error(e);
      }
    };
    reader.readAsText(file);
  }

  function clearData() {
    if (!confirm("Erase ALL entries and settings on this device? This can't be undone.")) return;
    if (!confirm("Really erase everything? Export a backup first if you're unsure.")) return;
    state = structuredClone(DEFAULTS);
    save(); render();
    closeOverlay("settingsOverlay");
    toast("All data erased.");
  }

  // ---------- Overlay control ----------
  function showOverlay(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
  function closeOverlay(id) {
    const el = $(id);
    el.classList.add("closing");
    setTimeout(() => { el.hidden = true; el.classList.remove("closing"); document.body.style.overflow = ""; }, 200);
  }

  // ---------- Wire up ----------
  function bind() {
    $("addBtn").addEventListener("click", () => openSheet(null));
    $("sheetClose").addEventListener("click", () => closeOverlay("sheetOverlay"));
    $("saveBtn").addEventListener("click", saveEntry);
    $("deleteBtn").addEventListener("click", deleteEntry);
    $("typeExpense").addEventListener("click", () => setType("expense"));
    $("typeIncome").addEventListener("click", () => setType("income"));

    $("settingsBtn").addEventListener("click", openSettings);
    $("settingsClose").addEventListener("click", () => closeOverlay("settingsOverlay"));

    $("addExpenseCat").addEventListener("click", () => { addCat("expense", $("newExpenseCat").value); $("newExpenseCat").value = ""; });
    $("addIncomeCat").addEventListener("click", () => { addCat("income", $("newIncomeCat").value); $("newIncomeCat").value = ""; });
    $("newExpenseCat").addEventListener("keydown", (e) => { if (e.key === "Enter") $("addExpenseCat").click(); });
    $("newIncomeCat").addEventListener("keydown", (e) => { if (e.key === "Enter") $("addIncomeCat").click(); });

    $("exportJson").addEventListener("click", exportJson);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; });
    $("clearData").addEventListener("click", clearData);

    $("prevMonth").addEventListener("click", () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1); render(); });
    $("nextMonth").addEventListener("click", () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1); render(); });
    $("monthLabel").addEventListener("click", () => { viewMonth = startOfMonth(new Date()); render(); });

    // tap backdrop to dismiss
    document.querySelectorAll(".overlay").forEach((ov) => {
      ov.addEventListener("click", (e) => { if (e.target === ov) closeOverlay(ov.id); });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") document.querySelectorAll(".overlay:not([hidden])").forEach((ov) => closeOverlay(ov.id));
    });
    $("amountInput").addEventListener("keydown", (e) => { if (e.key === "Enter") saveEntry(); });
  }

  bind();
  render();

  // ---------- PWA service worker ----------
  if ("serviceWorker" in navigator) {
    // If an updated worker takes control of an already-controlled page, the
    // app shell has changed — reload once so the user sees the new version.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        // Re-check for a new version whenever the app is brought to the
        // foreground (e.g. a home-screen PWA resumed from the background).
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update();
        });
      }).catch((e) => console.warn("SW registration failed:", e));
    });
  }
})();