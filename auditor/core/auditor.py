from collections import Counter
from core.model import ElementInfo, IssueRecord, AuditReport

def run_audit(elements: list[ElementInfo], source_file: str) -> AuditReport:
    # Amalyze IFC elements and return an audit report.

    total_elements = len(elements)

    counts_by_class = count_elements_by_class(elements)

    issues = find_missing_name_issues(elements)

    total_issues = len(issues)

    report = AuditReport(
        source_file=source_file,
        total_elements=total_elements,
        counts_by_class=counts_by_class,
        total_issues=total_issues,
        issues=issues
    )

    return report

def count_elements_by_class(elements: list[ElementInfo]) -> dict[str, int]:
    # Count how many elements exist for each IFC class.

    class_names = [element.ifc_class for element in elements]

    counts = Counter(class_names)

    return dict(counts)

def find_missing_name_issues(elements: list[ElementInfo]) -> list[IssueRecord]:
    # Find elements that are missing a Name value.
    issues: list[IssueRecord] = []

    for element in elements:
        if element.name is None or element.name.strip() == "":
            issue = IssueRecord(
                issue_code="MISSING_NAME",
                message="Element is missing a Name value",
                global_id=element.global_id,
                ifc_class=element.ifc_class,
                element_name=element.name
            )
            issues.append(issue)
    
    return issues