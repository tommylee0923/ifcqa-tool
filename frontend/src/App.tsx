import { useEffect, useState } from "react";
import type { AuditIssue, AuditRun } from "./types/audit";
import { fetchIssues, fetchRuns } from "./api/auditApi";
import DetailPanes from "./components/DetailPanes";
import FilterBar from "./components/FilterBar";
import IssueList from "./components/IssueList";
import IssueDetail from "./components/IssueDetail";
import RunList from "./components/RunList";
import "./App.css";

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AuditRun | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [ifcClassFilter, setIfcClassFilter] = useState("All");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);

        const runsData = await fetchRuns();
        setRuns(runsData);

        if (runsData.length === 0) {
          return;
        }

        setSelectedIssue(null);
        setIssues([]);

      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Unknown error"
        );
      } finally {
        setIsLoading(false);
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

      const issueData = await fetchIssues(run.id);
      setIssues(issueData);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Unknown error"
      );
    }
  }

  if (isLoading) {
    return <p>Loading...</p>;
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

  if (errorMessage) {
    return <p>{errorMessage}</p>;
  }

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

      <RunList runs={runs} onSelectRun={handleSelectRun} />
    </section>
  )

  function renderRunDetailView(run: AuditRun) {
    return (
      <section>
        <button
          className="btn btnSmall"
          onClick={() => setSelectedRun(null)}
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
                    <IssueList
                      issues={filteredIssues}
                      onSelectedIssue={setSelectedIssue}
                    />
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
          right={<canvas id="viewerCanvas"></canvas>}
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

export default App;