import csv
from pathlib import Path

from core.model import AuditReport

def write_csv_report(report: AuditReport, output_dir: str) -> None:
    # Write the audit report to CSV files

    output_folder = Path(output_dir)
    output_folder.parent.mkdir(parents=True, exist_ok=True)

    write_element_counts_csv(report, output_folder / "element_counts.csv")

def write_element_counts_csv(report: AuditReport, output_dir: Path) -> None:
    # Write element counts by IFC class to a CSV file

    with output_dir.open("w", newline="", encoding="utf-8") as f:
        writer=csv.writer(f)

        writer.writerow(["ifc_class", "count"])

        for ifc_class, count in sorted(report.counts_by_class.items()):
            writer.writerow([ifc_class, count])

def write_issues_csv(report: AuditReport, output_dir: Path) -> None:
    # Write issue records to a CSV file.

    with output_dir.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        writer.writerow([
            "issue_code",
            "message",
            "global_id",
            "ifc_class",
            "element_name",
        ])

        for issue in report.issues:
            writer.writerow([
                issue.issue_code,
                issue.message,
                issue.global_id,
                issue.ifc_class,
                issue.element_name
            ])