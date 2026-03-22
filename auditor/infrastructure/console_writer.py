from core.model import AuditReport

def write_console_report(report: AuditReport) -> None:
    # Print a human-readable audit summart to the terminal

    print("\n=== IFC MODEL AUDIT REPORT===")
    print(f"Source file: {report.source_file}")
    print(f"Total elements: {report.total_elements}")
    print(f"Total Issues: {report.total_issues}")

    print("\n--- Element Counts by IFC Class ---")
    for ifc_class, count in sorted(report.counts_by_class.items()):
        print(f"{ifc_class}: {count}")
    
    print("\n--- Issues ---")
    if not report.issues:
        print("No issues found.")
    else:
        for issue in report.issues:
            element_name = issue.element_name if issue.element_name is not None else "[No Name]"
            print(
                f"{issue.issue_code} | " 
                f"Severity: {issue.severity} | " 
                f"{issue.ifc_class} | " 
                f"{issue.global_id} | " 
                f"{element_name} | " 
                f"{issue.message} | " 
            )