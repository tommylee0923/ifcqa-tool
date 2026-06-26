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

export interface RuleType {
    id: number;
    name: string;
    description: string;
    required_fields: string[];
    optional_fields: string[];
}

export interface Rule {
    id: number;
    rule_type: string;
    rule_id: string;
    severity: string;
    ifc_class: string | null;
    pset: string | null;
    key: string | null;
    psets: string | null;
    pset_a: string | null;
    pset_b: string | null;
    key_a: string | null;
    key_b: string | null;
    qto: string | null;
    qty: string | null;
    qty_names: string[] | null;
    min_exclusive: number | null;
    allowed_values: string[] | null;
    regex: string | null;
    attribute: string | null;
    skip_if_missing: boolean;
    meta_title: string | null;
    meta_why: string | null;
    meta_how_to_fix: string | null;
}

export interface Ruleset {
    id: number;
    name: string;
    version: string | null;
    description: string | null;
    source: string;
    created_at: string;
    rule_count?: number;
    rules?: Rule[];
}