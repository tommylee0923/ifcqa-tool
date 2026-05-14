import type { AuditRun } from "../types/audit";

interface RunListProps {
    runs: AuditRun[];
    onSelectRun: (run: AuditRun) => void;
}

function RunList({ runs, onSelectRun }: RunListProps) {
    return (
        <section>
            <div className="tableWrap">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Source File</th>
                            <th>Timestamp</th>
                            <th>Elements</th>
                            <th>Issues</th>
                        </tr>
                    </thead>

                    <tbody>
                        {runs.map((run) => (
                            <tr key={run.id} onClick={() => onSelectRun(run)}>
                                <td>{run.source_file}</td>
                                <td>{run.run_timestamp}</td>
                                <td>{run.total_elements}</td>
                                <td>
                                    <span className="pill pill-issue">
                                        {run.total_issues}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default RunList;