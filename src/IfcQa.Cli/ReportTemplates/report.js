let activeRuleIds = null;

const data = JSON.parse(document.getElementById("data").textContent);
const issues = data.issues || [];

// header
const meta = document.getElementById("meta");
meta.textContent = `IFC: ${data.ifcPath} • Ruleset: ${data.ruleset.name} (${data.ruleset.version})`;

document.getElementById("cTotal").textContent = data.counts.total;
document.getElementById("cErrors").textContent = data.counts.errors;
document.getElementById("cWarnings").textContent = data.counts.warnings;
document.getElementById("cInfo").textContent = data.counts.info;

// controls
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


// drawer
const drawer = document.getElementById("drawer");
const overlay = document.getElementById("drawerOverlay");
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


let rulesetMetaByRuleId = {}; // { [ruleId]: { title, why, description } }
rulesetMetaByRuleId = data.rulesetMeta || {};

let currentIssue = null;

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
    if (state.sev != null) fSeverity.value = state.sev;
    if (state.rule != null) fRule.value = state.rule;
    if (state.cls != null) fClass.value = state.cls;
    if (state.q != null) fText.value = state.q;
    if (fGroup) fGroup.checked = state.group === "1";

    // keep chips synced (if you added them)
    const sevChips = document.getElementById("sevChips");
    if (sevChips) {
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
    // use replaceState so it doesn't spam history while typing
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

function uniq(arr) {
    return Array.from(new Set(arr)).sort();
}
function addOptions(select, label, values) {
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

addOptions(fSeverity, "Severity (All)", ["Error", "Warning", "Info"]);
addOptions(fRule, "Rule ID (All)", uniq(issues.map((i) => i.ruleId)));
addOptions(fClass, "IfcClass (All)", uniq(issues.map((i) => i.ifcClass)));
applyStateToUI(readStateFromHash());
rerenderAndPersist();

function severityRank(sev) {
    if (sev === "Error") return 0;
    if (sev === "Warning") return 1;
    return 2;
}

function matches(issue) {
    if (activeRuleIds && !activeRuleIds.has(issue.ruleId)) return false;

    const sev = fSeverity.value;
    const rule = fRule.value;
    const cls = fClass.value;
    const q = (fText.value || "").trim().toLowerCase();

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
    if (meta && (meta.title || meta.why || meta.description)) {
        dRuleMeta.classList.remove("hidden");
        dRuleInfo.textContent = [
            meta.title ? `Title: ${meta.title}` : "",
            meta.why ? `Why it matters: ${meta.why}` : "",
            meta.howToFix ? `How to fix: ${meta.howToFix}` : "",
            meta.description ? `Description: ${meta.description}` : "",
            meta.references && meta.references.length ? `References: ${meta.references.join(", ")}` : "",
        ]
            .filter(Boolean)
            .join("\n");
    } else {
        dRuleMeta.classList.add("hidden");
        dRuleInfo.textContent = "";
    }

    overlay.classList.remove("hidden");
    drawer.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
    overlay.classList.add("hidden");
    drawer.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
    currentIssue = null;
    clearSelectedRow();
}

function rerenderAndPersist() {
    writeStateToHash(getStateFromUI());
    render();
}

dClose.addEventListener("click", closeDrawer);
overlay.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
});

dCopy.addEventListener("click", async () => {
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

// Event delegation for copy clicks + row clicks
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
    if (tr) {
        const idx = Number(tr.dataset.idx);
        const issue = window.__viewIssues?.[idx];
        if (issue) {
            selectRowByIdx(idx);
            openDrawer(issue);
        }

    }
});

function renderFlat(filtered) {
    rows.innerHTML = "";
    const frag = document.createDocumentFragment();

    filtered.forEach((i, idx) => {
        const tr = document.createElement("tr");
        tr.dataset.idx = String(idx);

        const tdSev = document.createElement("td");
        tdSev.className = `sev ${i.severity}`;
        tdSev.textContent = i.severity;

        const tdRule = document.createElement("td");
        tdRule.textContent = i.ruleId;

        const tdClass = document.createElement("td");
        tdClass.textContent = i.ifcClass;

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

        tr.append(tdSev, tdRule, tdClass, tdGid, tdName, tdMsg);
        frag.appendChild(tr);
    });

    rows.appendChild(frag);
}

function renderGrouped(filtered) {
    rows.innerHTML = "";

    // Rebuild view list in EXACT row-render order
    window.__viewIssues = [];

    // Group by ruleId
    const groups = new Map();
    filtered.forEach((i) => {
        if (!groups.has(i.ruleId)) groups.set(i.ruleId, []);
        groups.get(i.ruleId).push(i);
    });

    // Sort rules deterministically: severity -> ruleId
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
      <span style="margin-left:10px;font-weight:800;">${ruleId}</span>
      <span class="pill" style="margin-left:10px;">${list.length} issues</span>
      ${meta.title ? `<span class="small" style="margin-left:10px;">${meta.title}</span>` : ""}
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

                // Map row -> issue
                window.__viewIssues.push(i);
                tr.dataset.idx = String(window.__viewIssues.length - 1);

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
        renderGrouped(filtered);          // grouped rebuilds __viewIssues internally
    } else {
        window.__viewIssues = filtered;   // flat uses direct mapping
        renderFlat(filtered);
    }

}


// controls wiring
const sevChips = document.getElementById("sevChips");
if (sevChips) {
    sevChips.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;

        const sev = btn.dataset.sev ?? "";
        fSeverity.value = sev;

        // update active chip
        sevChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");

        rerenderAndPersist();
    });
}
// Rule & class dropdowns can stay simple
[fRule, fClass].forEach((s) => s.addEventListener("change", rerenderAndPersist));

// Severity dropdown needs to sync chips
fSeverity.addEventListener("change", () => {
    if (sevChips) {
        const v = fSeverity.value || "";
        sevChips.querySelectorAll(".chip").forEach((c) => {
            c.classList.toggle("active", (c.dataset.sev ?? "") === v);
        });
    }
    rerenderAndPersist();
});

fText.addEventListener("input", rerenderAndPersist);
if (fGroup) fGroup.addEventListener("change", rerenderAndPersist);

// ruleset decoration (optional)
if (rulesetFile) {
    rulesetFile.addEventListener("change", async () => {
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
}

function clearSelectedRow() {
    rows.querySelectorAll("tr.selected").forEach(el => el.classList.remove("selected"));
}

function selectRowByIdx(idx) {
    clearSelectedRow();
    const tr = rows.querySelector(`tr[data-idx="${idx}"]`);
    if (tr) tr.classList.add("selected");
}

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

if (btnExportCsv) {
    btnExportCsv.addEventListener("click", () => {
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
}

if (btnCopyLink) {
    btnCopyLink.addEventListener("click", async () => {
        const url = location.href; // includes #hash
        try {
            await navigator.clipboard.writeText(url);
            btnCopyLink.textContent = "Copied!";
            setTimeout(() => (btnCopyLink.textContent = "Copy share link"), 800);
        } catch {
            prompt("Copy link:", url);
        }
    });
}

function setRulesetActive(isActive) {
  if (!btnClearRuleset) return;
  btnClearRuleset.classList.toggle("hidden", !isActive);
}

if (btnClearRuleset) {
  btnClearRuleset.addEventListener("click", () => {
    activeRuleIds = null;
    // restore meta back to embedded pack (if you want)
    rulesetMetaByRuleId = data.rulesetMeta || {};
    setRulesetActive(false);
    rerenderAndPersist();
  });
}