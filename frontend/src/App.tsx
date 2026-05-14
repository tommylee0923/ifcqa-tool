import { useEffect, useState } from "react";
import type { AuditIssue, AuditRun } from "./types/audit";
import { fetchIssues, fetchRuns } from "./api/auditApi";
import FilterBar from "./components/FilterBar";
import IssueList from "./components/IssueList";
import IssueDetail from "./components/IssueDetail";
import "./App.css";

function App() {
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
        const runsData = await fetchRuns();
        setRuns(runsData);

        if (runsData.length === 0) {
          return;
        }

        const latestRun = runsData[0];
        setSelectedRun(latestRun);

        const issuesData = await fetchIssues(latestRun.id);
        setIssues(issuesData);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Unknown error"
        );
      }
    }

    loadInitialData();
  }, []);

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

    return matchesSeverity && matchesIfcClass
  });

  if (errorMessage) {
    return <p>{errorMessage}</p>;
  }

  return (
    <main className="app">
      <header className="header">
        <h1>IfcQA React Frontend</h1>
        {selectedRun && (
          <p>
            Current run: {selectedRun.source_file} -{" "}
            {selectedRun.total_issues} issues
          </p>
        )}
      </header>
      
      {selectedIssue ? (
        <IssueDetail
          issue={selectedIssue}
          onBack={() => setSelectedIssue(null)}
        />
      ) : (
        <>
          <FilterBar
            severityFilter={severityFilter}
            onSeverityChange={setSeverityFilter}
            ifcClassFilter={ifcClassFilter}
            onIfcClassChange={setIfcClassFilter}
            ifcClasses={ifcClasses}
          />

          <IssueList
            issues={filteredIssues}
            onSelectedIssue={setSelectedIssue}
          />
        </>
      )}
    </main>
  );
}

export default App;