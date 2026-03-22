import json
from pathlib import Path

from core.model import AuditReport

def write_json_report(report: AuditReport, output_dir: str) -> None:
    # Write the audit report to a JSON file

    data = {
        "source_file": report.source_file,
        "total_elements": report.total_elements,
        "counts_by_class": report.counts_by_class,
        "total_issues":report.total_issues,
        "issues": [
            {
            "issue_code": issue.issue_code,
            "message": issue.message,
            "global_id": issue.global_id,
            "ifc_class": issue.ifc_class,
            "element_name": issue.element_name,
            } 
            for issue in report.issues
        ],
    }

    output_file = Path(output_dir)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)