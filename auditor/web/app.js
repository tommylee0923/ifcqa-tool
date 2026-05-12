// ============================================================
// #region STATE
// ============================================================
const state = {
    runs: [],
    issues: [],
    activeRunId: null,
    activeClass: "",
    activeSource: "",
};
// #endregion

// ============================================================
// #region API CALLS
// ============================================================
async function fetchRuns() {
    try {
        const response = await fetch("/runs");
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        return await response.json();
    } catch (err) {
        showError(runsList, `Could not load audit runs: ${err.message}`);
        return [];
    }
}

async function fetchIssues(runId) {
    try {
        const response = await fetch(`/runs/${runId}/issues`);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        return await response.json();
    } catch (err) {
        showError(issuesList, `Could not load issues: ${err.message}`);
        return [];
    }
}
// #endregion

// ============================================================
// #region RENDER — RUNS VIEW
// ============================================================
function renderStats(runs) {
    const totalRuns = runs.length;
    const totalElements = runs.reduce((sum, r) => sum + r.total_elements, 0);
    const totalIssues = runs.reduce((sum, r) => sum + r.total_issues, 0);
    const latest = runs.length > 0 ? runs[0].run_timestamp : "—";

    document.getElementById("stat-runs").textContent = totalRuns;
    document.getElementById("stat-elements").textContent = totalElements;
    document.getElementById("stat-issues").textContent = totalIssues;

    const latestEl = document.getElementById("stat-latest");
    latestEl.textContent = latest !== "—" ? latest.split(" ")[0] : "—";
}

function renderRuns(runs) {
    if (runs.length === 0) {
        showEmpty(runsList, "No audit runs found. Run an audit first.");
        return;
    }

    const html = `
        <div class="tableWrap">
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Source File</th>
                        <th>Timestamp</th>
                        <th>Elements</th>
                        <th>Issues</th>
                    </tr>
                </thead>
                <tbody>
                    ${runs.map(run => `
                        <tr data-run-id="${run.id}">
                            <td class="mono">${run.id}</td>
                            <td>${escapeHtml(run.source_file)}</td>
                            <td class="small">${run.run_timestamp}</td>
                            <td>${run.total_elements}</td>
                            <td>
                                <span class="${run.total_issues > 0 ? "pill pill-issue" : "pill"}">
                                    ${run.total_issues}
                                </span>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    runsList.innerHTML = html;

    runsList.addEventListener("click", (event) => {
        const row = event.target.closest("tr[data-run-id]");
        if (!row) return;
        const runId = parseInt(row.dataset.runId, 10);
        openRun(runId);
    });
}
// #endregion

// ============================================================
// #region RENDER — DETAIL VIEW
// ============================================================
function renderRunHeader(run) {
    runHeader.innerHTML = `
        <div class="run-detail-card">
            <div>
                <div class="run-detail-title">${escapeHtml(run.source_file)}</div>
                <div class="run-detail-meta">Run ID: ${run.id} &nbsp;·&nbsp; ${run.run_timestamp}</div>
            </div>
            <div class="run-detail-stats">
                <span class="pill">${run.total_elements} elements</span>
                <span class="pill ${run.total_issues > 0 ? "pill-issue" : ""}">
                    ${run.total_issues} issues
                </span>
            </div>
        </div>
    `;
}

function renderSourceChips(issues) {
    const sources = [...new Set(issues.map(i => i.source || "Unknown"))].sort();

    if (sources.length <= 1) {
        sourceChips.innerHTML = ""
        return;
    }

    const html = `
        <span class="chip-label">Engine</span>
        <button class="chip active" data-source="">All</button>
        ${sources.map(src => `
            <button class="chip" data-source="${escapeHtml(src)}">
                ${src === "ifcqa" ? "IfcQA" : src === "python" ? "Python" : escapeHtml(src)}
            </button>
        `).join("")}
    `;

    sourceChips.innerHTML = html;

    sourceChips.addEventListener("click", (event) => {
        const chip = event.target.closest(".chip");
        if (!chip) return;

        sourceChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");

        state.activeSource = chip.dataset.source;
        applyFilter();
    });
}

function renderClassChips(issues) {
    const classes = [...new Set(issues.map(i => i.ifc_class || "Unknown"))].sort();

    const html = `
        <button class="chip active" data-class="">All</button>
        ${classes.map(cls => `
            <button class="chip" data-class="${escapeHtml(cls)}">${escapeHtml(cls)}</button>
        `).join("")}
    `;

    classChips.innerHTML = html;

    classChips.addEventListener("click", (event) => {
        const chip = event.target.closest(".chip");
        if (!chip) return;

        classChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");

        state.activeClass = chip.dataset.class;
        applyFilter();
    });
}

function renderIssues(issues) {
    document.getElementById("shown").textContent = `${issues.length} shown`;

    if (issues.length === 0) {
        showEmpty(issuesList, "No issues match the current filter.");
        return;
    }

    const html = `
        <div class="tableWrap">
            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 120px;">Severity</th>
                        <th style="width: 140px;">Code</th>
                        <th>Message</th>
                        <th style="width: 160px;">IFC Class</th>
                        <th style="width: 80px;">Source</th>
                        <th style="width: 180px;">GlobalID</th>
                    </tr>
                </thead>
                <tbody>
                    ${issues.map(issue => `
                        <tr
                            data-gid="${escapeHtml(issue.global_id)}"
                            style="cursor:pointer"
                        >
                            <td>${severityBadge(issue.severity)}</td>
                            <td><span class="issue-code">${escapeHtml(issue.issue_code)}</span></td>
                            <td>
                                <div>${escapeHtml(issue.message)}</div>
                                ${issue.element_name
            ? `<div class="issue-meta">${escapeHtml(issue.element_name)}</div>`
            : ""}
                            </td>
                            <td>${escapeHtml(issue.ifc_class || "Unknown")}</td>
                            <td class="small">${escapeHtml(issue.source || "")}</td>
                            <td><span class="global-id">${escapeHtml(issue.global_id)}</span></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    issuesList.innerHTML = html;

    // Hover — highlight element in viewer
    issuesList.addEventListener("mouseover", (e) => {
        const row = e.target.closest("tr[data-gid]");
        const gid = row?.dataset.gid ?? null;
        window.dispatchEvent(new CustomEvent("ifcqa:hover", { detail: { gid } }));
    });

    issuesList.addEventListener("mouseleave", () => {
        window.dispatchEvent(new CustomEvent("ifcqa:hover", { detail: { gid: null } }));
    });

    // Click — select element in viewer
    issuesList.addEventListener("click", (e) => {
        const row = e.target.closest("tr[data-gid]");
        if (!row) return;
        const gid = row.dataset.gid ?? null;
        window.dispatchEvent(new CustomEvent("ifcqa:select", { detail: { gid } }));
    });

    issuesListView.classList.remove("hidden");
    issueDetailView.classList.add("hidden");
}

function showIssueDetail(issue) {
    issueDetail.innerHTML = `
        <div class="issue-detail-card">

            <div class="issue-detail-top">
                <div>
                    <div class="k">Issue Detail</div>
                    <h2>${escapeHtml(issue.issue_code ?? "Unknown Issue")}</h2>
                </div>
                <span class="sev ${escapeHtml(issue.severity ?? "")}">
                    ${escapeHtml(issue.severity ?? "Unknown")}
                </span>
            </div>

            <div class="issue-message">
                ${escapeHtml(issue.message ?? "No message provided.")}
            </div>

            <div class="issue-detail-grid">
                <div>
                    <div class="detail-label">IFC Class</div>
                    <div class="detail-value">${escapeHtml(issue.ifc_class ?? "—")}</div>
                </div>

                <div>
                    <div class="detail-label">Element Name</div>
                    <div class="detail-value">${escapeHtml(issue.element_name ?? "—")}</div>
                </div>

                <div>
                    <div class="detail-label">GlobalId</div>
                    <div class="detail-value mono">${escapeHtml(issue.global_id ?? "—")}</div>
                </div>

                <div>
                    <div class="detail-label">Path</div>
                    <div class="detail-value mono">${escapeHtml(issue.path ?? "—")}</div>
                </div>

                <div>
                    <div class="detail-label">Expected</div>
                    <div class="detail-value">${escapeHtml(issue.expected ?? "—")}</div>
                </div>

                <div>
                    <div class="detail-label">Actual</div>
                    <div class="detail-value">${escapeHtml(issue.actual ?? "—")}</div>
                </div>
            </div>

        </div>
    `;

    issuesListView.classList.add("hidden");
    issueDetailView.classList.remove("hidden");
}


// ============================================================
// #region NAVIGATION
// ============================================================
async function openRun(runId) {
    state.activeRunId = runId;
    state.activeClass = "";
    state.activeSource = "";

    const run = state.runs.find(r => r.id === runId);
    const issues = await fetchIssues(runId);
    state.issues = issues;

    renderRunHeader(run);
    renderSourceChips(issues);
    renderClassChips(issues);
    renderIssues(issues);

    window.loadRun(run)

    runsView.classList.add("hidden");
    detailView.classList.remove("hidden");

    requestAnimationFrame(() => {
        window.resizeViewer();
    });
}

function goBack() {
    state.activeRunId = null;
    state.issues = [];
    state.activeClass = "";
    state.activeSource = "";

    detailView.classList.add("hidden");
    runsView.classList.remove("hidden");
}
// #endregion

// ============================================================
// #region SPLITTER
// ============================================================
const root = document.documentElement;
const splitter = document.getElementById("splitter");

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

const saved = Number(localStorage.getItem("ifcqa:leftW"));
if (!Number.isNaN(saved) && saved > 0) {
    root.style.setProperty("--leftW", `${saved}px`);
}

let dragging = false;

splitter.addEventListener("pointerdown", (e) => {
    e.preventDefault();

    dragging = true;
    splitter.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing");
    document.body.classList.add("no-select");
});

splitter.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    e.preventDefault()

    const container = document.querySelector(".detail-panes");
    if (!container) return;

    const rect = container.getBoundingClientRect();

    const min = 320;
    const max = Math.max(min + 50, rect.width - 320);

    const localX = e.clientX - rect.left;
    const nextW = clamp(localX, min, max);

    root.style.setProperty("--leftW", `${nextW}px`);

    if (typeof window.resizeViewer === "function") {
        window.resizeViewer();
    }
});

function endDrag(e) {
    if (!dragging) return;
    dragging = false;

    document.body.classList.remove("resizing");
    document.body.classList.remove("no-select");

    const w = parseFloat(getComputedStyle(root).getPropertyValue("--leftW")) || 520;
    localStorage.setItem("ifcqa:leftW", String(Math.round(w)));

    try {
        splitter.releasePointerCapture(e.pointerId);
    } catch { }

    if (typeof window.resizeViewer === "function") {
        window.resizeViewer();
    }
}

splitter.addEventListener("pointerup", endDrag);
splitter.addEventListener("pointercancel", endDrag);

window.addEventListener("resize", () => {
    const container = document.querySelector(".detail-panes");
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const current = parseFloat(getComputedStyle(root).getPropertyValue("--leftW")) || 520;

    const min = 320;
    const max = Math.max(min + 50, rect.width - 320);
    const clamped = clamp(current, min, max);

    root.style.setProperty("--leftW", `${clamped}px`);

    if (typeof window.resizeViewer === "function") {
        window.resizeViewer();
    }
});

// #endregion

// ============================================================
// #region FILTERING
// ============================================================
function applyFilter() {
    let filtered = state.issues;

    if (state.activeSource) {
        filtered = filtered.filter(i => (i.source || "") === state.activeSource);
    }

    if (state.activeClass) {
        filtered = filtered.filter(i => (i.ifc_class || "Unknown") === state.activeClass);
    }

    renderIssues(filtered);
}
// #endregion

// ============================================================
// #region HELPERS
// ============================================================
function severityBadge(severity) {
    if (!severity) return `<span class="sev unknown">—</span>`;
    return `<span class="sev ${escapeHtml(severity)}">${escapeHtml(severity)}</span>`;
}

function showEmpty(container, message) {
    container.innerHTML = `<div class="state-message">${message}</div>`;
}

function showError(container, message) {
    container.innerHTML = `<div class="state-message error">${message}</div>`;
}

function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
// #endregion

// ============================================================
// #region DOM REFERENCES + INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

    window.runsView = document.getElementById("runs-view");
    window.detailView = document.getElementById("detail-view");
    window.runsList = document.getElementById("runs-list");
    window.runHeader = document.getElementById("run-header");
    window.issuesList = document.getElementById("issues-list");
    window.sourceChips = document.getElementById("source-chips");

    window.classChips = document.getElementById("class-chips");
    window.backBtn = document.getElementById("back-btn");

    // NEW: left-pane subviews
    window.issuesListView = document.getElementById("issues-list-view");
    window.issueDetailView = document.getElementById("issue-detail-view");
    window.issueDetail = document.getElementById("issue-detail");
    window.issueDetailBack = document.getElementById("issue-detail-back");

    backBtn.addEventListener("click", goBack);

    issueDetailBack.addEventListener("click", () => {
        issueDetailView.classList.add("hidden");
        issuesListView.classList.remove("hidden");
    });

    issuesList.addEventListener("click", (e) => {
        const row = e.target.closest("tr[data-gid]");
        if (!row) return;

        const gid = row.dataset.gid;
        const issue = state.issues.find(i => i.global_id === gid);

        if (!issue) return;

        showIssueDetail(issue);

        window.dispatchEvent(new CustomEvent("ifcqa:select", {
            detail: { gid }
        }));
    });

    (async () => {
        const runs = await fetchRuns();
        state.runs = runs;
        renderStats(runs);
        renderRuns(runs);
    })();
});
// #endregion