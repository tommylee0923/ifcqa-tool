import type { AuditIssue, AuditRun, Ruleset } from "../types/audit";

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
    options?: { rulesetFile?: File; rulesetId?: number, convertGlb?: boolean }
): Promise<{ run_id: number; total_elements: number; total_issues: number }> {
    const form = new FormData();
    form.append("ifc_file", ifcFile);
    if (options?.rulesetFile) form.append("ruleset_file", options.rulesetFile);
    if (options?.rulesetId !== undefined) form.append("ruleset_id", String(options.rulesetId)); 
    form.append("convert_glb", options?.convertGlb === false ? "false" : "true");

    const res = await fetch("/upload", { method: "POST", body: form });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.description ?? "Upload failed");
    }
    return res.json();
}

export async function fetchRulesets(): Promise<Ruleset[]> {
    const res = await fetch("/rulesets");
    if (!res.ok) {
        throw new Error("Failed to fetch rulesets");
    }
    return res.json();
}

export async function fetchRuleset(id: number): Promise<Ruleset> {
    const res = await fetch(`/rulesets/${id}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch ruleset ${id}`);
    }
    return res.json();
}