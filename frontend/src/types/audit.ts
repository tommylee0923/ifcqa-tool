export interface AuditIssue {
    issue_code: string;
    severity: string;
    message: string;
    global_id?: string | null;
    ifc_class?: string | null;
    element_name?: string | null;
    source?: string | null;
    path?: string | null;
    expected?: string | null;
    actual?: string | null;

}

export interface AuditReport {
    issues: AuditIssue[];
}

export interface AuditRun {
    id: number;
    source_file: string;
    run_timestamp: string;
    total_elements: number;
    total_issues: number;
    glb_filename?: string;
}