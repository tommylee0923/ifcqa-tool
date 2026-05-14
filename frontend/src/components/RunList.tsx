import type { AuditRun } from "../types/audit";

interface RunListProps {
    runs: AuditRun[];
    onSelectRun: (run: AuditRun) => void;
}

function RunList({ runs, onSelectRun }: RunListProps) {
    return (
        <section>
            <h2>Audit Runs</h2>

            <ul>
                {runs.map((run) => (
                    <li key="{run.id">
                        <button onClick={() => onSelectRun(run)}>
                            <strong>{run.source_file}</strong>
                            <br />
                            {run.run_timestamp}
                            <br />
                            {run.total_elements} elements - {run.total_issues} issues
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default RunList;