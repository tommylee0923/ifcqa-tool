from __future__ import annotations
from abc import ABC, abstractmethod
import ifcopenshell
from core.model import IssueRecord
from core.context import AuditContext

class BaseRule(ABC):
    """
    Abstract base class for all validation rules.
    """

    def __init__(self, rule_id: str, severity: str):
        self.rule_id = rule_id
        self.severity = severity
    
    @abstractmethod
    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        ...
    
    # ========================================================================
    # Convenience factory for bulding IssueRecord consistently
    # ========================================================================

    def _issue(
            self,
            global_id: str,
            ifc_class: str,
            message: str,
            element_name: str | None = None,
            path: str | None = None,
            expected: str | None = None,
            actual: str | None = None,
    ) -> IssueRecord:
        return IssueRecord(
            issue_code=self.rule_id,
            severity=self.severity,
            message=message,
            global_id=global_id,
            ifc_class=ifc_class,
            element_name=element_name,
            path=path,
            expected=expected,
            actual=actual,
        )