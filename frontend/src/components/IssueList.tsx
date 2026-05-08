import type { AuditIssue } from "../types/audit";

interface IssueListProps {
    issues: AuditIssue[];
}

function IssueList({ issues }: IssueListProps) {
    return (
        <section>
            <h2>Issues</h2>

            <ul>
                {issues.map((issue, index) => (
                    <li key={index}>
                        <strong>{issue.issue_code}</strong> - {issue.severity}
                        <p>{issue.message}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default IssueList;