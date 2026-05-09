import type { AuditIssue } from "../types/audit";

interface IssueDetailProps {
    issue: AuditIssue | null;
}

function IssueDetail({ issue }: IssueDetailProps) {
    if (!issue) {
        return <p>Select an issue to view details.</p>
    }

    return (
        <section>
            <h2>Issue Detail</h2>

            <p><strong>Code:</strong> {issue.issue_code}</p>
            <p><strong>Severity:</strong> {issue.severity}</p>
            <p><strong>Message:</strong> {issue.message}</p>
            <p><strong>Global ID:</strong> {issue.global_id ?? "N/A"}</p>
            <p><strong>IFC Class:</strong> {issue.ifc_class ?? "N/A"}</p>
            <p><strong>Element Name:</strong> {issue.element_name ?? "N/A"}</p>
        </section>
    );
}

export default IssueDetail;