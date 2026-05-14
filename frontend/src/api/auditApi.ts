import type { AuditIssue, AuditRun } from "../types/audit";

export async function fetchRuns(): Promise<AuditRun[]> {
    const response = await fetch("/runs");

    if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
    }

    return await response.json();
}

export async function fetchIssues(runId: number): Promise<AuditIssue[]> {
    const response = await fetch(`/runs/${runId}/issues`);

    if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
    }

    return await response.json();
}