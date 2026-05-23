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