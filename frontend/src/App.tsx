import { useEffect, useState } from "react";
import type { AuditIssue, AuditReport } from "./types/audit";
import IssueList from "./components/IssueList";
import IssueDetail from "./components/IssueDetail";

function App() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);

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

  return (
    <main>
      <h1>IfcQA React Frontend</h1>
      <p>Total issues: {report.issues.length}</p>

      <IssueList
        issues={report.issues}
        onSelectedIssue={setSelectedIssue} />

      <IssueDetail issue={selectedIssue} />
    </main>
  );
}

export default App;