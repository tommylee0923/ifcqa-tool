// ============================================================
// #region STATE
// ============================================================
const state = {
    runs: [],
    issues: [],
    activeRunId: null,
    activeClass: "",    // "" means "All" — same pattern as IfcQA's severity filter
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
                        <th style="width: 140px;">Code</th>
                        <th>Message</th>
                        <th style="width: 180px;">IFC Class</th>
                        <th style="width: 200px;">GlobalID</th>
                    </tr>
                </thead>
                <tbody>
                    ${issues.map(issue => `
                        <tr>
                            <td><span class="issue-code">${escapeHtml(issue.issue_code)}</span></td>
                            <td>
                                <div>${escapeHtml(issue.message)}</div>
                                ${issue.element_name
            ? `<div class="issue-meta">${escapeHtml(issue.element_name)}</div>`
            : ""}
                            </td>
                            <td>${escapeHtml(issue.ifc_class || "Unknown")}</td>
                            <td><span class="global-id">${escapeHtml(issue.global_id)}</span></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    issuesList.innerHTML = html;
}


// ============================================================
// #region NAVIGATION
// ============================================================
async function openRun(runId) {
    state.activeRunId = runId;
    state.activeClass = "";

    const run = state.runs.find(r => r.id === runId);
    const issues = await fetchIssues(runId);
    state.issues = issues;

    renderRunHeader(run);
    renderClassChips(issues);
    renderIssues(issues);

    runsView.classList.add("hidden");
    detailView.classList.remove("hidden");
}

function goBack() {
    state.activeRunId = null;
    state.issues = [];
    state.activeClass = "";

    detailView.classList.add("hidden");
    runsView.classList.remove("hidden");
}
// #endregion

// ============================================================
// #region FILTERING
// ============================================================
function applyFilter() {
    const filtered = state.activeClass
        ? state.issues.filter(i => (i.ifc_class || "Unknown") === state.activeClass)
        : state.issues;

    renderIssues(filtered);
}
// #endregion

// ============================================================
// #region HELPERS
// ============================================================
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
    window.classChips = document.getElementById("class-chips");
    window.backBtn = document.getElementById("back-btn");

    backBtn.addEventListener("click", goBack);

    (async () => {
        const runs = await fetchRuns();
        state.runs = runs;
        renderStats(runs);
        renderRuns(runs);
    })();
});
// #endregion