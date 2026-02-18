//#region Data + Header

let activeRuleIds = null;

const data = JSON.parse(document.getElementById("data").textContent);
const issues = data.issues || [];

const meta = document.getElementById("meta");
meta.textContent = `IFC: ${data.ifcPath} • Ruleset: ${data.ruleset.name} (${data.ruleset.version})`;

document.getElementById("cTotal").textContent = data.counts.total;
document.getElementById("cErrors").textContent = data.counts.errors;
document.getElementById("cWarnings").textContent = data.counts.warnings;
document.getElementById("cInfo").textContent = data.counts.info;

//#endregion


//#region DOM References

const leftPanel = document.querySelector(".leftPanel");

const fSeverity = document.getElementById("fSeverity");
const fRule = document.getElementById("fRule");
const fClass = document.getElementById("fClass");
const fText = document.getElementById("fText");
const fGroup = document.getElementById("fGroup");
const rulesetFile = document.getElementById("rulesetFile");

const rows = document.getElementById("rows");
const shown = document.getElementById("shown");

const btnExportCsv = document.getElementById("btnExportCsv");
const btnCopyLink = document.getElementById("btnCopyLink");
const btnClearRuleset = document.getElementById("btnClearRuleset");

const tableWrap = document.querySelector(".tableWrap");

// Floating copy
const floatingCopyBtn = document.getElementById("floatingCopyBtn");
const floatingCopyLabel = floatingCopyBtn?.querySelector(".label") || null;

// Drawer
const drawer = document.getElementById("drawer");
const dClose = document.getElementById("dClose");
const dTitle = document.getElementById("dTitle");
const dSubtitle = document.getElementById("dSubtitle");
const dSeverity = document.getElementById("dSeverity");
const dRule = document.getElementById("dRule");
const dClass = document.getElementById("dClass");
const dGlobalId = document.getElementById("dGlobalId");
const dCopy = document.getElementById("dCopy");
const dName = document.getElementById("dName");
const dMessage = document.getElementById("dMessage");
const dRuleMeta = document.getElementById("dRuleMeta");
const dRuleInfo = document.getElementById("dRuleInfo");
const dPath = document.getElementById("dPath");
const dSource = document.getElementById("dSource");
const dExpected = document.getElementById("dExpected");
const dActual = document.getElementById("dActual");

//#endregion


//#region State

let rulesetMetaByRuleId = data.rulesetMeta || {};
let currentIssue = null;

let __hoveredIdx = null;

// Floating copy tracking
let activeRowEl = null;
let activeGid = "";

//#endregion


//#region Helpers (general)

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function uniq(arr) {
  return Array.from(new Set(arr)).sort();
}

function addOptions(select, label, values) {
  if (!select) return;
  select.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = label;
  select.appendChild(opt0);
  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

function severityRank(sev) {
  if (sev === "Error") return 0;
  if (sev === "Warning") return 1;
  return 2;
}

//#endregion


//#region URL State (hash sync)

function getStateFromUI() {
  return {
    sev: fSeverity?.value || "",
    rule: fRule?.value || "",
    cls: fClass?.value || "",
    q: fText?.value || "",
    group: (fGroup && fGroup.checked) ? "1" : "0",
  };
}

function applyStateToUI(state) {
  if (!state) return;

  if (state.sev != null && fSeverity) fSeverity.value = state.sev;
  if (state.rule != null && fRule) fRule.value = state.rule;
  if (state.cls != null && fClass) fClass.value = state.cls;
  if (state.q != null && fText) fText.value = state.q;
  if (fGroup) fGroup.checked = state.group === "1";

  const sevChips = document.getElementById("sevChips");
  if (sevChips && fSeverity) {
    const v = fSeverity.value || "";
    sevChips.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("active", (c.dataset.sev ?? "") === v);
    });
  }
}

function writeStateToHash(state) {
  const p = new URLSearchParams();
  if (state.sev) p.set("sev", state.sev);
  if (state.rule) p.set("rule", state.rule);
  if (state.cls) p.set("cls", state.cls);
  if (state.q) p.set("q", state.q);
  if (state.group === "1") p.set("group", "1");
  const hash = p.toString();
  history.replaceState(null, "", hash ? `#${hash}` : "#");
}

function readStateFromHash() {
  const hash = (location.hash || "").replace(/^#/, "");
  const p = new URLSearchParams(hash);
  return {
    sev: p.get("sev") || "",
    rule: p.get("rule") || "",
    cls: p.get("cls") || "",
    q: p.get("q") || "",
    group: p.get("group") || "0",
  };
}

//#endregion


//#region Filters + Matching

function matches(issue) {
  if (activeRuleIds && !activeRuleIds.has(issue.ruleId)) return false;

  const sev = fSeverity?.value || "";
  const rule = fRule?.value || "";
  const cls = fClass?.value || "";
  const q = (fText?.value || "").trim().toLowerCase();

  if (sev && issue.severity !== sev) return false;
  if (rule && issue.ruleId !== rule) return false;
  if (cls && issue.ifcClass !== cls) return false;

  if (!q) return true;

  return (
    (issue.globalId || "").toLowerCase().includes(q) ||
    (issue.name || "").toLowerCase().includes(q) ||
    (issue.message || "").toLowerCase().includes(q)
  );
}

//#endregion


//#region Rendering (flat / grouped / root)

function renderFlat(filtered) {
  rows.innerHTML = "";
  const frag = document.createDocumentFragment();

  filtered.forEach((i, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.idx = String(idx);
    tr.dataset.gid = i.globalId || "";

    const tdSev = document.createElement("td");
    tdSev.className = `col-sev sev ${i.severity}`;
    tdSev.textContent = i.severity || "";

    const tdRule = document.createElement("td");
    tdRule.className = "col-rule ruleOneLine";
    tdRule.title = i.ruleId || "";
    tdRule.textContent = i.ruleId || "";

    const tdClass = document.createElement("td");
    tdClass.className = "col-class ruleOneLine";
    tdClass.title = i.ifcClass || "";
    tdClass.textContent = i.ifcClass || "";

    const tdName = document.createElement("td");
    tdName.className = "col-name small nameOneLine";
    tdName.title = i.name || "";
    tdName.textContent = i.name || "";

    const tdMsg = document.createElement("td");
    tdMsg.className = "col-msg";
    tdMsg.innerHTML = `<div class="msgTwoLine">${escapeHtml(i.message || "")}</div>`;

    tr.append(tdSev, tdRule, tdClass, tdName, tdMsg);
    frag.appendChild(tr);
  });

  rows.appendChild(frag);
}

function renderGrouped(filtered) {
  rows.innerHTML = "";
  window.__viewIssues = [];

  const groups = new Map();
  filtered.forEach((i) => {
    if (!groups.has(i.ruleId)) groups.set(i.ruleId, []);
    groups.get(i.ruleId).push(i);
  });

  const ruleIds = Array.from(groups.keys()).sort((a, b) => {
    const la = groups.get(a);
    const lb = groups.get(b);
    const ra = severityRank(la[0]?.severity);
    const rb = severityRank(lb[0]?.severity);
    if (ra !== rb) return ra - rb;
    return (a || "").localeCompare(b || "");
  });

  const frag = document.createDocumentFragment();

  ruleIds.forEach((ruleId) => {
    const list = groups.get(ruleId);
    const sev = list[0]?.severity || "Info";
    const meta = rulesetMetaByRuleId[ruleId] || {};

    const trGroup = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;

    const details = document.createElement("details");
    details.open = true;

    const summary = document.createElement("summary");
    summary.style.cursor = "pointer";
    summary.innerHTML = `
      <span class="sev ${sev}">${sev}</span>
      <span style="margin-left:10px;font-weight:800;">${escapeHtml(ruleId || "")}</span>
      <span class="pill" style="margin-left:10px;">${list.length} issues</span>
      ${meta.title ? `<span class="small" style="margin-left:10px;">${escapeHtml(meta.title)}</span>` : ""}
    `;

    const body = document.createElement("div");
    body.style.marginTop = "10px";

    if (meta.why) {
      const why = document.createElement("div");
      why.className = "small";
      why.style.margin = "0 0 10px";
      why.textContent = `Why it matters: ${meta.why}`;
      body.appendChild(why);
    }

    const inner = document.createElement("table");
    inner.className = "table";
    inner.innerHTML = `
      <thead>
        <tr>
          <th style="width:140px;">IfcClass</th>
          <th style="width:240px;">GlobalId</th>
          <th style="width:200px;">Name</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = inner.querySelector("tbody");

    list
      .slice()
      .sort(
        (a, b) =>
          (a.ifcClass || "").localeCompare(b.ifcClass || "") ||
          (a.name || "").localeCompare(b.name || "") ||
          (a.globalId || "").localeCompare(b.globalId || "")
      )
      .forEach((i) => {
        const tr = document.createElement("tr");

        window.__viewIssues.push(i);
        tr.dataset.idx = String(window.__viewIssues.length - 1);
        tr.dataset.gid = i.globalId || "";

        const tdClass = document.createElement("td");
        tdClass.textContent = i.ifcClass || "";

        const tdGid = document.createElement("td");
        const gidSpan = document.createElement("span");
        gidSpan.className = "copy";
        gidSpan.dataset.copy = i.globalId || "";
        gidSpan.textContent = i.globalId || "";
        tdGid.appendChild(gidSpan);

        const tdName = document.createElement("td");
        tdName.className = "small";
        tdName.textContent = i.name || "";

        const tdMsg = document.createElement("td");
        tdMsg.textContent = i.message || "";

        tr.append(tdClass, tdGid, tdName, tdMsg);
        tbody.appendChild(tr);
      });

    body.appendChild(inner);
    details.append(summary, body);
    td.appendChild(details);
    trGroup.appendChild(td);
    frag.appendChild(trGroup);
  });

  rows.appendChild(frag);
}

function render() {
  const filtered = issues.filter(matches);

  filtered.sort((a, b) => {
    const ra = severityRank(a.severity);
    const rb = severityRank(b.severity);
    if (ra !== rb) return ra - rb;
    return (a.ruleId || "").localeCompare(b.ruleId || "") ||
      (a.ifcClass || "").localeCompare(b.ifcClass || "") ||
      (a.name || "").localeCompare(b.name || "") ||
      (a.globalId || "").localeCompare(b.globalId || "");
  });

  window.__currentFiltered = filtered;
  shown.textContent = `${filtered.length} shown`;

  if (fGroup && fGroup.checked) {
    renderGrouped(filtered);
  } else {
    window.__viewIssues = filtered;
    renderFlat(filtered);
  }
}

function rerenderAndPersist() {
  writeStateToHash(getStateFromUI());
  render();
}

//#endregion


//#region Drawer

function openDrawer(issue) {
  currentIssue = issue;

  dTitle.textContent = issue.ruleId || "Issue";
  dSubtitle.textContent = `${issue.ifcClass || ""} • ${issue.name || ""}`.trim();

  dSeverity.textContent = issue.severity || "";
  dRule.textContent = issue.ruleId || "";
  dClass.textContent = issue.ifcClass || "";
  dGlobalId.textContent = issue.globalId || "";
  dName.textContent = issue.name || "";
  dMessage.textContent = issue.message || "";
  dPath.textContent = issue.path || "";
  dSource.textContent = issue.source || "";
  dExpected.textContent = issue.expected || "";
  dActual.textContent = issue.actual || "";

  const meta = rulesetMetaByRuleId[issue.ruleId];
  if (meta && (meta.title || meta.why || meta.description || meta.howToFix)) {
    dRuleMeta.classList.remove("hidden");
    dRuleInfo.textContent = [
      meta.title ? `Title: ${meta.title}` : "",
      meta.why ? `Why it matters: ${meta.why}` : "",
      meta.howToFix ? `How to fix: ${meta.howToFix}` : "",
      meta.description ? `Description: ${meta.description}` : "",
      meta.references && meta.references.length ? `References: ${meta.references.join(", ")}` : "",
    ].filter(Boolean).join("\n");
  } else {
    dRuleMeta.classList.add("hidden");
    dRuleInfo.textContent = "";
  }

  leftPanel.classList.add("drawerOpen");
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  leftPanel.classList.remove("drawerOpen");
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
  currentIssue = null;
  clearSelectedRow();
}

// Drawer events
dClose?.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

dCopy?.addEventListener("click", async () => {
  const txt = (currentIssue && currentIssue.globalId) || "";
  if (!txt) return;
  try {
    await navigator.clipboard.writeText(txt);
    dCopy.textContent = "Copied!";
    setTimeout(() => (dCopy.textContent = "Copy"), 700);
  } catch {
    prompt("Copy GlobalId:", txt);
  }
});

//#endregion


//#region Row Selection + Viewer Events (hover/select)

function clearSelectedRow() {
  rows.querySelectorAll("tr.selected").forEach(el => el.classList.remove("selected"));
}

function selectRowByIdx(idx) {
  clearSelectedRow();
  const tr = rows.querySelector(`tr[data-idx="${idx}"]`);
  if (tr) tr.classList.add("selected");
}

rows.addEventListener("click", async (e) => {
  const copyEl = e.target.closest(".copy");
  if (copyEl) {
    const txt = copyEl.dataset.copy || "";
    try {
      await navigator.clipboard.writeText(txt);
      const prev = copyEl.textContent;
      copyEl.textContent = "Copied!";
      setTimeout(() => (copyEl.textContent = prev), 600);
    } catch {
      prompt("Copy GlobalId:", txt);
    }
    return;
  }

  const tr = e.target.closest("tr[data-idx]");
  if (!tr) return;

  const idx = Number(tr.dataset.idx);
  const issue = window.__viewIssues?.[idx];
  if (!issue) return;

  selectRowByIdx(idx);
  window.dispatchEvent(new CustomEvent("ifcqa:select", { detail: { gid: issue.globalId } }));
  openDrawer(issue);
});

rows.addEventListener("mouseover", (e) => {
  const tr = e.target.closest("tr[data-idx]");
  if (!tr) return;

  const idx = Number(tr.dataset.idx);
  if (__hoveredIdx === idx) return;
  __hoveredIdx = idx;

  const issue = window.__viewIssues?.[idx];
  const gid = issue?.globalId || tr.dataset.gid || null;

  window.dispatchEvent(new CustomEvent("ifcqa:hover", { detail: { gid } }));
});

rows.addEventListener("mouseout", (e) => {
  const tr = e.target.closest("tr[data-idx]");
  if (!tr) return;

  const to = e.relatedTarget;
  if (to && tr.contains(to)) return;

  __hoveredIdx = null;
  window.dispatchEvent(new CustomEvent("ifcqa:hover", { detail: { gid: null } }));
});

//#endregion


//#region Floating Copy Button

function positionFloatingCopy(rowEl) {
  if (!rowEl || !floatingCopyBtn) return;

  const panelRect = leftPanel.getBoundingClientRect();
  const rowRect = rowEl.getBoundingClientRect();

  const btnRect = floatingCopyBtn.getBoundingClientRect();
  const left = panelRect.right - 12 - (btnRect.width || 44);
  const top = rowRect.top + rowRect.height / 2 - (btnRect.height || 28) / 2;

  floatingCopyBtn.style.left = `${left}px`;
  floatingCopyBtn.style.top = `${top}px`;
}

function showFloatingCopy(rowEl) {
  if (!floatingCopyBtn) return;

  activeRowEl = rowEl;
  activeGid = rowEl?.dataset?.gid || "";
  if (!activeGid) return;

  floatingCopyBtn.classList.remove("hidden");
  positionFloatingCopy(rowEl);
}

function hideFloatingCopy() {
  if (!floatingCopyBtn) return;

  activeRowEl = null;
  activeGid = "";
  floatingCopyBtn.classList.add("hidden");
}

rows.addEventListener("mousemove", (e) => {
  const tr = e.target.closest("tr");
  if (!tr || !rows.contains(tr)) return;
  if (tr === activeRowEl) return;
  showFloatingCopy(tr);
});

tableWrap?.addEventListener("mouseleave", (e) => {
  if (e.relatedTarget && floatingCopyBtn.contains(e.relatedTarget)) return;
  hideFloatingCopy();
});

floatingCopyBtn?.addEventListener("mouseleave", (e) => {
  if (e.relatedTarget && tableWrap.contains(e.relatedTarget)) return;
  hideFloatingCopy();
});

leftPanel.addEventListener("scroll", () => {
  if (activeRowEl) positionFloatingCopy(activeRowEl);
});

floatingCopyBtn?.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!activeGid) return;

  try {
    await navigator.clipboard.writeText(activeGid);

    if (floatingCopyLabel) floatingCopyLabel.textContent = "Copied";
    floatingCopyBtn.classList.add("copied");
    requestAnimationFrame(() => positionFloatingCopy(activeRowEl));

    setTimeout(() => {
      if (floatingCopyLabel) floatingCopyLabel.textContent = "Copy GlobalID";
      floatingCopyBtn.classList.remove("copied");
      requestAnimationFrame(() => positionFloatingCopy(activeRowEl));
    }, 600);
  } catch { }
});

//#endregion


//#region Controls Wiring

const sevChips = document.getElementById("sevChips");
if (sevChips) {
  sevChips.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;

    const sev = btn.dataset.sev ?? "";
    if (fSeverity) fSeverity.value = sev;

    sevChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");

    rerenderAndPersist();
  });
}

[fRule, fClass].forEach((s) => s && s.addEventListener("change", rerenderAndPersist));

fSeverity?.addEventListener("change", () => {
  if (sevChips && fSeverity) {
    const v = fSeverity.value || "";
    sevChips.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("active", (c.dataset.sev ?? "") === v);
    });
  }
  rerenderAndPersist();
});

fText?.addEventListener("input", rerenderAndPersist);
fGroup?.addEventListener("change", rerenderAndPersist);

//#endregion


//#region Ruleset JSON Decoration

function setRulesetActive(isActive) {
  if (!btnClearRuleset) return;
  btnClearRuleset.classList.toggle("hidden", !isActive);
}

rulesetFile?.addEventListener("change", async () => {
  const f = rulesetFile.files?.[0];
  if (!f) return;

  try {
    const text = await f.text();
    const rs = JSON.parse(text);

    activeRuleIds = new Set((rs.rules || []).map(r => r.id));
    setRulesetActive(true);

    const map = {};
    (rs.rules || []).forEach((r) => {
      const m = r.meta || {};
      map[r.id] = {
        title: m.title || r.title || "",
        why: m.why || r.whyItMatters || r.why || "",
        howToFix: m.howToFix || "",
        description: r.description || m.description || "",
        references: Array.isArray(m.references) ? m.references : []
      };
    });

    rulesetMetaByRuleId = map;
    rerenderAndPersist();
  } catch (err) {
    alert("Failed to load ruleset JSON.");
    console.error(err);
  }
});

btnClearRuleset?.addEventListener("click", () => {
  activeRuleIds = null;
  rulesetMetaByRuleId = data.rulesetMeta || {};
  setRulesetActive(false);
  rerenderAndPersist();
});

//#endregion


//#region CSV Export + Share Link

function csvEscape(v) {
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const header = ["severity", "ruleId", "ifcClass", "globalId", "name", "message"];
  const lines = [header.join(",")];

  for (const r of rows) {
    lines.push([
      csvEscape(r.severity),
      csvEscape(r.ruleId),
      csvEscape(r.ifcClass),
      csvEscape(r.globalId),
      csvEscape(r.name),
      csvEscape(r.message),
    ].join(","));
  }

  return lines.join("\n");
}

btnExportCsv?.addEventListener("click", () => {
  const filtered = window.__currentFiltered || [];
  const csv = toCsv(filtered);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "ifcqa_filtered.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
});

btnCopyLink?.addEventListener("click", async () => {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    btnCopyLink.textContent = "Copied!";
    setTimeout(() => (btnCopyLink.textContent = "Copy share link"), 800);
  } catch {
    prompt("Copy link:", url);
  }
});

//#endregion


//#region Init

addOptions(fSeverity, "Severity (All)", ["Error", "Warning", "Info"]);
addOptions(fRule, "Rule ID (All)", uniq(issues.map((i) => i.ruleId)));
addOptions(fClass, "IfcClass (All)", uniq(issues.map((i) => i.ifcClass)));

applyStateToUI(readStateFromHash());
setRulesetActive(false);
rerenderAndPersist();

//#endregion