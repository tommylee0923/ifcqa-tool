import { useEffect, useState } from "react";
import type { AuditIssue, AuditRun } from "./types/audit";
import { fetchIssues, fetchRuns } from "./api/auditApi";
import DetailPanes from "./components/DetailPanes";
import FilterBar from "./components/FilterBar";
import IssueList from "./components/IssueList";
import IssueDetail from "./components/IssueDetail";
import RunList from "./components/RunList";
import Viewer from "./components/Viewer";
import "./App.css";
import { disposeViewer } from "./viewer/viewer";

function App() {
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AuditRun | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [ifcClassFilter, setIfcClassFilter] = useState("All");
  const [runsError, setRunsError] = useState<string | null>(null);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoadingRuns(true);
        setRunsError(null);

        const runsData = await fetchRuns();
        setRuns(runsData);

        if (runsData.length === 0) {
          return;
        }

        setSelectedIssue(null);
        setIssues([]);

      } catch (err) {
        setRunsError(getErrorMessage(err));
      } finally {
        setIsLoadingRuns(false);
      }
    }

    loadInitialData();
  }, []);

  async function handleSelectRun(run: AuditRun) {
    try {
      setSelectedRun(run);
      setSelectedIssue(null);
      setSeverityFilter("All");
      setIfcClassFilter("All");
      setIssuesError(null);

      const issueData = await fetchIssues(run.id);
      setIssues(issueData);
    } catch (err) {
      setIssues([]);
      setIssuesError(getErrorMessage(err));
    }
  }

  const ifcClasses = Array.from(
    new Set(
      issues
        .map((issue) => issue.ifc_class)
        .filter((ifcClass): ifcClass is string => Boolean(ifcClass))
    )
  );

  const filteredIssues = issues.filter((issue) => {
    const matchesSeverity =
      severityFilter === "All" || issue.severity === severityFilter;

    const matchesIfcClass =
      ifcClassFilter === "All" || issue.ifc_class === ifcClassFilter;

    return matchesSeverity && matchesIfcClass;
  });

  const dashboardView = (
    <section>
      <div className="grid">
        <div className="card">
          <div className="k">Total Runs</div>
          <div className="v">{runs.length}</div>
        </div>

        <div className="card">
          <div className="k">Total Elements</div>
          <div className="v">
            {runs.reduce((sum, run) => sum + run.total_elements, 0)}
          </div>
        </div>

        <div className="card">
          <div className="k">Total Issues</div>
          <div className="v">
            {runs.reduce((sum, run) => sum + run.total_issues, 0)}
          </div>
        </div>

        <div className="card">
          <div className="k">Latest Run</div>
          <div className="v small">
            {runs[0]?.run_timestamp ?? "—"}
          </div>
        </div>
      </div>

      {isLoadingRuns && (
        <div className="state-message">Loading audit runs...</div>
      )}

      {!isLoadingRuns && runsError && (
        <div className="state-message error" role="alert">
          <p>Could not load runs.</p>
          <p className="small">{runsError}</p>
          <p className="small">
            Make sure Flask is running at http://127.0.0.1:5000 and output/audit.db exists.
          </p>
        </div>
      )}

      {!isLoadingRuns && !runsError && runs.length === 0 && (
        <div className="state-message">
          No audit runs found. Run an audit first.
        </div>
      )}

      {!isLoadingRuns && !runsError && runs.length > 0 && (
        <RunList runs={runs} onSelectRun={handleSelectRun} />
      )}
    </section>
  )

  function handleSelectIssue(issue: AuditIssue) {
    setSelectedIssue(issue);
    window.dispatchEvent(
      new CustomEvent("ifcqa:select", {
        detail: { gid: issue.global_id ?? null },
      })
    );
  }

  function renderRunDetailView(run: AuditRun) {
    return (
      <section>
        <button
          className="btn btnSmall"
          onClick={() => {
            disposeViewer();
            setSelectedRun(null);
            setSelectedIssue(null);
            setIssuesError(null);
          }}
        >
          ← Back to Runs
        </button>

        <div className="run-detail-card">
          <div>
            <div className="run-detail-title">{run.source_file}</div>
            <div className="run-detail-meta">{run.run_timestamp}</div>
          </div>

          <div className="run-detail-stats">
            <span className="pill">{run.total_elements} elements</span>
            <span className="pill pill-issue">{run.total_issues} issues</span>
          </div>
        </div>

        <DetailPanes
          left={
            <>
              {!selectedIssue && (
                <div className="issues-pane-layout">
                  <div className="issues-pane-header">
                    <FilterBar
                      severityFilter={severityFilter}
                      onSeverityChange={setSeverityFilter}
                      ifcClassFilter={ifcClassFilter}
                      onIfcClassChange={setIfcClassFilter}
                      ifcClasses={ifcClasses}
                    />
                    <div className="controls">
                      <span className="pill">{filteredIssues.length} shown</span>
                    </div>
                  </div>
                  <div className="issues-pane-scroll">
                    {issuesError ? (
                      <div className="state-message error" role="alert">
                        <p>Could not load issues for this run.</p>
                        <p className="small">{issuesError}</p>
                      </div>
                    ) : (
                      <IssueList
                        issues={filteredIssues}
                        onSelectedIssue={handleSelectIssue}
                      />
                    )}
                  </div>
                </div>
              )}

              {selectedIssue && (
                <div className="issues-pane-layout">
                  <div className="issues-pane-header">

                    <button
                      type="button"
                      className="btn btnSmall"
                      style={{ marginBottom: 14 }}
                      onClick={() => setSelectedIssue(null)}
                    >
                      ← Back to Issues
                    </button>
                  </div>
                  <div className="issues-pane-scroll">
                    <IssueDetail issue={selectedIssue} />
                  </div>
                </div>
              )}
            </>
          }
          right={<Viewer run={selectedRun} />}
        />
      </section>
    );
  }

  return (
    <main className="wrap">
      <div className="h1">IfcQA</div>
      <div className="meta">IFC Model QA Dashboard</div>

      {!selectedRun && dashboardView}
      {selectedRun && renderRunDetailView(selectedRun)}
    </main>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown Error";
}

export default App;