from __future__ import annotations

from collections import Counter
import ifcopenshell

from core.model import ElementInfo, AuditReport
from core.rules.factory import build_rules
from core.context import AuditContext
from infrastructure.ruleset_loader import load_ruleset


def run_audit(
    elements: list[ElementInfo],
    source_file: str,
    model: ifcopenshell.file | None = None,
    ruleset_path: str | None = None,
) -> AuditReport:
    """
    Run the IFC audit pipeline and return an audit report.
    """

    total_elements = len(elements)
    counts_by_class = count_elements_by_class(elements)

    issues = []

    if ruleset_path:
        if model is None:
            raise ValueError(
                "ruleset_path was provided, but no IFC model was passed to run_audit()."
            )

        ruleset = load_ruleset(ruleset_path)
        rules = build_rules(ruleset.rules)

        
        context = AuditContext.from_model(model)
        for rule in rules:
            issues.extend(rule.evaluate(context))

    return AuditReport(
        source_file=source_file,
        total_elements=total_elements,
        counts_by_class=counts_by_class,
        total_issues=len(issues),
        issues=issues,
    )


def count_elements_by_class(elements: list[ElementInfo]) -> dict[str, int]:
    """
    Count how many elements exist for each IFC class.
    """

    class_names = [element.ifc_class for element in elements]
    counts = Counter(class_names)

    return dict(counts)