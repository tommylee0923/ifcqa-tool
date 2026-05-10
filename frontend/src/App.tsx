import { useEffect, useState } from "react";
import type { AuditIssue, AuditReport } from "./types/audit";
import FilterBar from "./components/FilterBar";
import IssueList from "./components/IssueList";
import IssueDetail from "./components/IssueDetail";

function App() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [ifcClassFilter, setIfcClassFilter] = useState("All");

  useEffect(() => {
    async function loadReport() {
      const res = await fetch("/sample-audit.json");
      const data = await res.json();
      setReport(data);
    }
    loadReport();
  }, []);

  // Before data loads, show loading text
  if (!report) {
    return <p>Loading audit report...</p>;
  }

  const ifcClasses = Array.from(
    new Set(
      report.issues
        .map((issue) => issue.ifc_class)
        .filter((ifcClass): ifcClass is string => Boolean(ifcClass))
    )
  );

  const filteredIssues = report.issues.filter((issue) => {
    const matchesSeverity =
      severityFilter === "All" || issue.severity === severityFilter;

    const matchesIfcClass =
      ifcClassFilter === "All" || issue.ifc_class === ifcClassFilter;

    return matchesSeverity && matchesIfcClass
  });

  return (
    <main>
      <h1>IfcQA React Frontend</h1>
      <p>Total issues: {report.issues.length}</p>
      <label>
        Severity:
      </label>
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
            ifcClasses={ifcClasses} />

          <IssueList
            issues={filteredIssues}
            onSelectedIssue={setSelectedIssue} />
        </>
      )}
    </main>
  );
}

export default App;