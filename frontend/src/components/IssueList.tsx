import type { AuditIssue } from "../types/audit";
import type { IfcqaGidDetail } from "../types/ifcqaEvent";

interface IssueListProps {
    issues: AuditIssue[];
    onSelectedIssue: (issue: AuditIssue) => void;
}

function SeverityBadge({ severity }: { severity: string | null | undefined }) {
    if (!severity) {
        return <span className="sev unknown">—</span>;
    }

    return <span className={`sev ${severity}`}>{severity}</span>;
}

function issueRowKey(issue: AuditIssue, index: number): string {
    return [
        issue.global_id ?? "no-gid",
        issue.issue_code,
        issue.message,
        index,
    ].join("-");
}

function IssueList({ issues, onSelectedIssue }: IssueListProps) {
    if (issues.length === 0) {
        return (
            <div className="state-message">
                No issues match the current filter.
            </div>
        );
    }

    return (
        <div className="tableWrap">
            <table className="table">
                <thead>
                    <tr>
                        <th style={{ width: 120 }}>Severity</th>
                        <th style={{ width: 140 }}>Code</th>
                        <th>Message</th>
                        <th style={{ width: 160 }}>IFC Class</th>
                        <th style={{ width: 80 }}>Source</th>
                        <th style={{ width: 180 }}>GlobalID</th>
                    </tr>
                </thead>
                <tbody
                    onMouseLeave={() => {
                        window.dispatchEvent(
                            new CustomEvent<IfcqaGidDetail>("ifcqa:hover", { detail: { gid: null } })
                        );
                    }}
                >
                    {issues.map((issue, index) => (
                        <tr
                            key={issueRowKey(issue, index)}
                            data-gid={issue.global_id ?? ""}
                            onClick={() => onSelectedIssue(issue)}
                            onMouseEnter={() => {
                                window.dispatchEvent(
                                    new CustomEvent<IfcqaGidDetail>("ifcqa:hover", {
                                        detail: { gid: issue.global_id ?? null },
                                    })
                                );
                            }}
                        >
                            <td>
                                <SeverityBadge severity={issue.severity} />
                            </td>
                            <td>
                                <span className="issue-code">{issue.issue_code}</span>
                            </td>
                            <td>
                                <div>{issue.message}</div>
                                {issue.element_name ? (
                                    <div className="issue-meta">{issue.element_name}</div>
                                ) : null}
                            </td>
                            <td>{issue.ifc_class || "Unknown"}</td>
                            <td className="small">{issue.source ?? ""}</td>
                            <td>
                                <span className="global-id">{issue.global_id ?? ""}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default IssueList;
