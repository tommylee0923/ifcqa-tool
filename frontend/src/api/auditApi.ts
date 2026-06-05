import type { AuditIssue, AuditRun } from "../types/audit";

export const IS_DEV = import.meta.env.DEV;
export const IS_FLASK = import.meta.env.VITE_API_MODE === "flask"

export async function fetchRuns(): Promise<AuditRun[]> {
    const url = (IS_FLASK || IS_DEV)
        ? "/runs"
        : `${import.meta.env.BASE_URL}/docs/demo-data/runs.json`;

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Failed to fetch runs`);
    }

    return await res.json();
}

export async function fetchIssues(
    runId: number
): Promise<AuditIssue[]> {

    const url = (IS_FLASK || IS_DEV)
        ? `/runs/${runId}/issues`
        : `${import.meta.env.BASE_URL}demo-data/run-${runId}-issues.json`;

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Failed to fetch issues`);
    }

    return await res.json();
}

export async function uploadIfc(
    ifcFile: File,
    options?: { rulesetFile?: File; convertGlb?: boolean }
): Promise<{ run_id: number; total_elements: number; total_issues: number }> {
    const form = new FormData();
    form.append("ifc_file", ifcFile);
    if (options?.rulesetFile) form.append("ruleset_file", options.rulesetFile);
    form.append("convert_glb", options?.convertGlb === false ? "false" : "true");

    const res = await fetch("/upload", { method: "POST", body: form });
    if (~res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.description ?? "Uploaded failed");
    }
    return res.json();
}