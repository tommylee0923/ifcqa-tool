import type { AuditIssue } from "../types/audit";

interface IssueDetailProps {
    issue: AuditIssue;
}

function IssueDetail({ issue }: IssueDetailProps) {
    return (
        <div className="issue-detail-card">
            <div className="issue-detail-top">
                <div>
                    <div className="k">Issue Detail</div>
                    <h2>{issue.issue_code}</h2>
                </div>

                <span className={`sev ${issue.severity}`}>
                    {issue.severity}
                </span>
            </div>

            <div className="issue-Message">
                {issue.message || "No message provided."}
            </div>

            <div className="issue-detail-grid">
                <DetailField label="IFC Class" value={issue.ifc_class} />
                <DetailField label="Element Name" value={issue.element_name} />
                <DetailField label="GlobalId" value={issue.global_id} mono />
                <DetailField label="Path" value={issue.path} mono />
                <DetailField label="Expected" value={issue.expected} />
                <DetailField label="Actual" value={issue.actual} />
            </div>
        </div>
    );
}

interface DetailFieldProps {
    label: string;
    value?: string | null;
    mono?: boolean;
}

function DetailField({ label, value, mono }: DetailFieldProps) {
    return (
        <div>
            <div className="detail-label">{label}</div>
            <div className={mono ? "detail-valie mono" : "detail-value"}>
                {value ?? "-"}
            </div>
        </div>
    )
}

export default IssueDetail;