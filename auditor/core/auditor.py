from __future__ import annotations

from collections import Counter
import ifcopenshell

from core.model import ElementInfo, IssueRecord, AuditReport
from core.rules.factory import build_rules, RuleFactoryError
from infrastructure.ruleset_loader import load_ruleset, RulesetValidationError


SKIP_CLASSES = {"IfcAnnotation", "IfcOpeningElement"}


def run_audit(
    elements: list[ElementInfo], 
    source_file: str,
    model: ifcopenshell.file | None = None,
    ruleset_path: str | None = None,
    ) -> AuditReport:
    """
    Amalyze IFC elements and return an audit report.
    
    Built-in checks use ElementInfo.
    JSON ruleset checks use the raw IfcOpenShell model.
    """

    total_elements = len(elements)
    counts_by_class = count_elements_by_class(elements)

    issues: list[IssueRecord] = []
    issues.extend(find_missing_name_issues(elements))
    
    if ruleset_path:
        if model is None:
            raise ValueError(
                "ruleset_path was provided, but no IFC model was pssed to run_audit()."
            )
        ruleset = load_ruleset(ruleset_path)
        rules = build_rules(ruleset.rules)
        
        for rule in rules:
            issues.extend(rule.evaluate(model))

    total_issues = len(issues)

    return AuditReport(
        source_file=source_file,
        total_elements=total_elements,
        counts_by_class=counts_by_class,
        total_issues=total_issues,
        issues=issues
    )

def count_elements_by_class(elements: list[ElementInfo]) -> dict[str, int]:
    """
    Count how many elements exist for each IFC class.
    """

    class_names = [element.ifc_class for element in elements]

    counts = Counter(class_names)

    return dict(counts)

def find_missing_name_issues(elements: list[ElementInfo]) -> list[IssueRecord]:
    """
    Built-in rule: flag elements missing name.
    """
    
    issues: list[IssueRecord] = []
    for element in elements:
        if element.ifc_class in SKIP_CLASSES:
            continue
        if element.name is None or element.name.strip() == "":
            issue = IssueRecord(
                issue_code="MISSING_NAME",
                message=f"{element.ifc_class} is missing a Name value",
                global_id=element.global_id,
                ifc_class=element.ifc_class,
                element_name=element.name,
                severity="Warning",
            )
            issues.append(issue)
    return issues