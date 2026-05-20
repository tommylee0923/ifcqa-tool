import json
import sqlite3
from pathlib import Path

DB_PATH = Path("output/audit.db")
OUT_DIR = Path("frontend/public/demo-data")

OUT_DIR.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

# =================================================
# Export runs
# =================================================

runs = conn.execute("""
SELECT
    id,
    source_file,
    run_timestamp,
    total_elements,
    total_issues
FROM audit_runs
ORDER BY run_timestamp DESC
""").fetchall()

runs_data = [dict(r) for r in runs]

with open(OUT_DIR / "runs.json", "w") as f:
    json.dump(runs_data, f, indent=2)

# =================================================
# Export issues per run
# =================================================

for run in runs:
    run_id = run["id"]

    issues = conn.execute("""
    SELECT *
    FROM issues
    WHERE audit_run_id = ?
    """, (run_id,)).fetchall()

    issues_data = [dict(i) for i in issues]

    with open(OUT_DIR / f"run-{run_id}-issues.json", "w") as f:
        json.dump(issues_data, f, indent=2)

conn.close()

print("Demo data exported.")