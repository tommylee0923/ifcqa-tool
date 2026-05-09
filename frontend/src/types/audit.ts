export interface AuditIssue {
    issue_code: string;
    severity: string;
    message: string;
    global_id?: string | null;
    ifc_class?: string | null;
    element_name?: string | null;
}

export interface AuditReport {
    issues: AuditIssue[];
}