import type { AuditIssue } from "../types/audit";

interface IssueListProps {
    issues: AuditIssue[];
    onSelectedIssue: (issue: AuditIssue) => void;
}

function IssueList({ issues, onSelectedIssue }: IssueListProps) {
    return (
        <section>
            <h2>Issues</h2>

            <ul className="issue-list">
                {issues.map((issue, index) => (
                    <li className="issue-item" key={index}>
                        <button className="issue-button" onClick={() => onSelectedIssue(issue)}>
                            <strong>{issue.issue_code}</strong> - {issue.severity}
                        </button>

                        <p>{issue.message}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default IssueList;