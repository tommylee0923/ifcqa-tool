from __future__ import annotations
import re
import ifcopenshell
from core.context import AuditContext
from core.model import IssueRecord
from core.rules.base import BaseRule
from core.rules.pset_utils import (
    get_psets,
    get_pset_value,
    get_qtos,
    get_qto_value,
    has_pset,
    has_qto,
    get_attribute,
    get_type_psets,
    get_instance_psets,
)


def _elements_of_class(context: AuditContext, ifc_class: str):
    """Return all IfcProduct instances matching the given IFC class name."""
    return context.get_elements(ifc_class)

# ============================================================
# RequireNonEmpty
# Check that a specific pset key exists and is not empty.
# ============================================================

class RuleRequireNonEmpty(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str, pset: str, key: str, skip_if_missing: bool = False):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset
        self.key = key
        self.skip_if_missing = skip_if_missing

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            psets = get_psets(e)
            ps = psets.get(self.pset)

            if ps is None:
                if self.skip_if_missing:
                    continue
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Missing property set '{self.pset}' (required for '{self.key}').",
                    element_name=getattr(e, "Name", None),
                    path=f"Pset: {self.pset}",
                    expected="Present",
                    actual="Missing",
                ))
                continue

            val = ps.get(self.key)
            if val is None or str(val).strip() == "":
                if self.skip_if_missing:
                    continue
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Property '{self.pset}.{self.key}' must not be empty.",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset}.{self.key}",
                    expected="Non-empty",
                    actual=str(val).strip() if val is not None else "",
                ))
        return issues


# ============================================================
# RequireNonEmptyAny
# Check that either a direct attribute OR a pset key is non-empty.
# ============================================================

class RuleRequireNonEmptyAny(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 attribute: str | None, pset: str | None, key: str | None):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.attribute = attribute
        self.pset = pset
        self.key = key

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            attr_val = get_attribute(e, self.attribute) if self.attribute else None
            if attr_val:
                continue

            pset_val = get_pset_value(e, self.pset, self.key) if self.pset and self.key else None
            if pset_val:
                continue

            issues.append(self._issue(
                e.GlobalId, e.is_a(),
                f"Expected non-empty value in either attribute '{self.attribute}' or '{self.pset}.{self.key}'.",
                element_name=getattr(e, "Name", None),
                path=f"Either Attribute: {self.attribute} or {self.pset}.{self.key}",
                expected="Non-empty",
                actual=f"Attribute: {attr_val or ''}; Pset: {pset_val or ''}",
            ))
        return issues


# ============================================================
# RequireNonEmptyEither
# Check that at least one of two pset keys is non-empty.
# ============================================================

class RuleRequireNonEmptyEither(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 pset_a: str, key_a: str, pset_b: str, key_b: str,
                 skip_if_missing: bool = False):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset_a = pset_a
        self.key_a = key_a
        self.pset_b = pset_b
        self.key_b = key_b
        self.skip_if_missing = skip_if_missing

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            a = get_pset_value(e, self.pset_a, self.key_a)
            b = get_pset_value(e, self.pset_b, self.key_b)

            if a or b:
                continue

            if self.skip_if_missing:
                psets = get_psets(e)
                a_exists = self.pset_a in psets and self.key_a in psets.get(self.pset_a, {})
                b_exists = self.pset_b in psets and self.key_b in psets.get(self.pset_b, {})
                if not a_exists and not b_exists:
                    continue

            issues.append(self._issue(
                e.GlobalId, e.is_a(),
                f"Expected non-empty value in either '{self.pset_a}.{self.key_a}' or '{self.pset_b}.{self.key_b}'.",
                element_name=getattr(e, "Name", None),
                path=f"Either({self.pset_a}.{self.key_a}, {self.pset_b}.{self.key_b})",
                expected="Non-empty",
                actual=f"{self.pset_a}.{self.key_a}='{a or ''}', {self.pset_b}.{self.key_b}='{b or ''}'",
            ))
        return issues


# ============================================================
# AllowedValues
# Check that a pset value is one of an allowed set.
# ============================================================

class RuleAllowedValues(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 pset: str, key: str, allowed_values: list[str],
                 skip_if_missing: bool = False):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset
        self.key = key
        self.allowed = {v.strip().lower() for v in allowed_values}
        self.allowed_display = allowed_values
        self.skip_if_missing = skip_if_missing

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            psets = get_psets(e)
            ps = psets.get(self.pset)

            if ps is None:
                if self.skip_if_missing:
                    continue
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Missing property set '{self.pset}'.",
                    element_name=getattr(e, "Name", None),
                    path=self.pset,
                    expected="Present",
                    actual="Missing",
                ))
                continue

            val = ps.get(self.key)
            if val is None or str(val).strip() == "":
                if self.skip_if_missing:
                    continue
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Property '{self.pset}.{self.key}' must not be empty.",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset}.{self.key}",
                    expected=f"One of: {', '.join(self.allowed_display)}",
                    actual="",
                ))
                continue

            norm = str(val).strip().lower()
            if norm not in self.allowed:
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Property '{self.pset}.{self.key}' value '{val}' is not an allowed value.",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset}.{self.key}",
                    expected=f"One of: {', '.join(self.allowed_display)}",
                    actual=str(val).strip(),
                ))
        return issues


# ============================================================
# RequireEqualStrings
# Check that two pset values match each other.
# ============================================================

class RuleRequireEqualStrings(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 pset_a: str, key_a: str, pset_b: str, key_b: str,
                 skip_if_missing: bool = False):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset_a = pset_a
        self.key_a = key_a
        self.pset_b = pset_b
        self.key_b = key_b
        self.skip_if_missing = skip_if_missing

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            a = get_pset_value(e, self.pset_a, self.key_a)
            b = get_pset_value(e, self.pset_b, self.key_b)

            if not a or not b:
                continue

            if a.lower() != b.lower():
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Mismatch: '{self.pset_a}.{self.key_a}' = '{a}' but '{self.pset_b}.{self.key_b}' = '{b}'.",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset_a}.{self.key_a} == {self.pset_b}.{self.key_b}",
                    expected=f"{self.pset_a}.{self.key_a} = {self.pset_b}.{self.key_b}",
                    actual=f"{self.pset_a}.{self.key_a}='{a}', {self.pset_b}.{self.key_b}='{b}'",
                ))
        return issues


# ============================================================
# RegexMatch
# Check that an attribute or pset value matches a regex pattern.
# ============================================================

class RuleRegexMatch(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 pattern: str, attribute: str | None = None,
                 pset: str | None = None, key: str | None = None,
                 skip_if_missing: bool = False):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pattern = re.compile(pattern)
        self.attribute = attribute
        self.pset = pset
        self.key = key
        self.skip_if_missing = skip_if_missing

    def _target_description(self) -> str:
        if self.attribute:
            return f"Attribute '{self.attribute}'"
        return f"Property '{self.pset}.{self.key}'"

    def _get_value(self, element: ifcopenshell.entity_instance) -> str | None:
        if self.attribute:
            return get_attribute(element, self.attribute)
        if self.pset and self.key:
            return get_pset_value(element, self.pset, self.key)
        return None

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            val = self._get_value(e)

            if not val:
                if self.skip_if_missing:
                    continue
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"{self._target_description()} is missing or empty.",
                    element_name=getattr(e, "Name", None),
                    path=self._target_description(),
                    expected="Non-empty",
                    actual="",
                ))
                continue

            if not self.pattern.search(val):
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"{self._target_description()} value '{val}' does not match pattern '{self.pattern.pattern}'.",
                    element_name=getattr(e, "Name", None),
                    path=self._target_description(),
                    expected=f"Regex: {self.pattern.pattern}",
                    actual=val,
                ))
        return issues


# ============================================================
# RequirePset
# Check that a pset exists on the element.
# ============================================================

class RuleRequirePset(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str, pset: str):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            if not has_pset(e, self.pset):
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Missing required property set '{self.pset}'.",
                    element_name=getattr(e, "Name", None),
                    path=f"Pset: {self.pset}",
                    expected="Present",
                    actual="Missing",
                ))
        return issues


# ============================================================
# RequireAnyPset
# Check that at least one pset from a list exists on the element.
# ============================================================

class RuleRequireAnyPset(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str, psets: list[str]):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.psets = psets

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            element_psets = get_psets(e)
            if not any(p in element_psets for p in self.psets):
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Missing required property set — expected at least one of: {', '.join(self.psets)}.",
                    element_name=getattr(e, "Name", None),
                    path=f"AnyPset: [{', '.join(self.psets)}]",
                    expected="At least one present",
                    actual="None found",
                ))
        return issues


# ============================================================
# RequirePsetPropertyKey
# Check that a specific key exists within a pset.
# ============================================================

class RuleRequirePsetPropertyKey(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str, pset: str, key: str):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset
        self.key = key

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            psets = get_psets(e)
            ps = psets.get(self.pset)
            if ps is None:
                continue
            if self.key not in ps:
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Pset '{self.pset}' is missing property key '{self.key}'.",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset}.{self.key}",
                    expected="Present",
                    actual="Missing",
                ))
        return issues


# ============================================================
# RequirePsetBool
# Check that a pset key exists and is a valid boolean.
# ============================================================

class RuleRequirePsetBool(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str, pset: str, key: str):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset
        self.key = key

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            psets = get_psets(e)
            ps = psets.get(self.pset)
            if ps is None:
                continue
            val = ps.get(self.key)
            if val is None or not isinstance(val, bool):
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Property '{self.key}' in '{self.pset}' is missing or not a boolean.",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset}.{self.key}",
                    expected="Boolean",
                    actual=str(val) if val is not None else "Missing",
                ))
        return issues


# ============================================================
# RequirePsetNumber
# Check that a pset key is numeric and above a minimum threshold.
# ============================================================

class RuleRequirePsetNumber(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 pset: str, key: str, min_exclusive: float = 0.0):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset
        self.key = key
        self.min_exclusive = min_exclusive

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            psets = get_psets(e)
            ps = psets.get(self.pset)
            if ps is None:
                continue
            val = ps.get(self.key)
            if val is None:
                continue
            try:
                num = float(val)
            except (TypeError, ValueError):
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Property '{self.key}' in '{self.pset}' is not numeric.",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset}.{self.key}",
                    expected="Numeric",
                    actual=str(val),
                ))
                continue
            if num <= self.min_exclusive:
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Property '{self.key}' in '{self.pset}' must be > {self.min_exclusive} (found {num}).",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset}.{self.key}",
                    expected=f"> {self.min_exclusive}",
                    actual=str(num),
                ))
        return issues


# ============================================================
# ComparePsetNumbers
# Check that one numeric pset value is >= another in the same pset.
# ============================================================

class RuleComparePsetNumbers(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 pset: str, key_a: str, key_b: str):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset
        self.key_a = key_a
        self.key_b = key_b

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            psets = get_psets(e)
            ps = psets.get(self.pset)
            if ps is None:
                continue
            try:
                a = float(ps[self.key_a]) if self.key_a in ps else None
                b = float(ps[self.key_b]) if self.key_b in ps else None
            except (TypeError, ValueError):
                continue
            if a is None or b is None:
                continue
            if a < b:
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"'{self.key_a}' ({a}) should be >= '{self.key_b}' ({b}) in '{self.pset}'.",
                    element_name=getattr(e, "Name", None),
                    path=f"{self.pset}.{self.key_a} >= {self.pset}.{self.key_b}",
                    expected=f">= {self.key_b}",
                    actual=f"{self.key_a}={a}, {self.key_b}={b}",
                ))
        return issues


# ============================================================
# SurveyValue
# Diagnostic rule — reports observed values without flagging as errors.
# ============================================================

class RuleSurveyValue(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str, pset: str, key: str):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset
        self.key = key

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            val = get_pset_value(e, self.pset, self.key)
            if val is None:
                continue
            issues.append(self._issue(
                e.GlobalId, e.is_a(),
                f"Observed '{self.pset}.{self.key}' = '{val}'",
                element_name=getattr(e, "Name", None),
                path=f"{self.pset}.{self.key}",
            ))
        return issues


# ============================================================
# RequireInstanceEqualsType
# Check that an instance pset value matches the type pset value.
# ============================================================

class RuleRequireInstanceEqualsType(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 pset: str, key: str, skip_if_missing: bool = False):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.pset = pset
        self.key = key
        self.skip_if_missing = skip_if_missing

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            inst_psets = get_instance_psets(e)
            type_psets = get_type_psets(e)

            inst_val = (inst_psets.get(self.pset) or {}).get(self.key)
            type_val = (type_psets.get(self.pset) or {}).get(self.key)

            inst_str = str(inst_val).strip() if inst_val is not None else None
            type_str = str(type_val).strip() if type_val is not None else None

            if not inst_str or not type_str:
                if self.skip_if_missing:
                    continue
                continue

            if inst_str.lower() != type_str.lower():
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Instance '{self.pset}.{self.key}' = '{inst_str}' differs from Type '{self.pset}.{self.key}' = '{type_str}'.",
                    element_name=getattr(e, "Name", None),
                    path=f"Instance:{self.pset}.{self.key} == Type:{self.pset}.{self.key}",
                    expected=type_str,
                    actual=inst_str,
                ))
        return issues


# ============================================================
# Quantity set rules
# ============================================================

class RuleRequireQto(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str, qto: str):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.qto = qto

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            if not has_qto(e, self.qto):
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Missing required quantity set '{self.qto}'.",
                    element_name=getattr(e, "Name", None),
                    path=f"Qto: {self.qto}",
                    expected="Present",
                    actual="Missing",
                ))
        return issues


class RuleRequireQtoQuantityNames(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 qto: str, qty_names: list[str]):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.qto = qto
        self.qty_names = qty_names

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            qtos = get_qtos(e)
            qto = qtos.get(self.qto)
            if qto is None:
                continue
            available = {k.lower() for k in qto.keys()}
            for name in self.qty_names:
                if name.lower() not in available:
                    issues.append(self._issue(
                        e.GlobalId, e.is_a(),
                        f"Qto '{self.qto}' is missing quantity '{name}'.",
                        element_name=getattr(e, "Name", None),
                        path=f"Qto: {self.qto}.{name}",
                        expected="Present",
                        actual="Missing",
                    ))
        return issues


class RuleRequireQtoQuantityValueNumber(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str,
                 qto: str, qty: str, min_exclusive: float = 0.0):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class
        self.qto = qto
        self.qty = qty
        self.min_exclusive = min_exclusive

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues = []
        for e in _elements_of_class(context, self.ifc_class):
            val = get_qto_value(e, self.qto, self.qty)
            if val is None:
                continue
            if val <= self.min_exclusive:
                issues.append(self._issue(
                    e.GlobalId, e.is_a(),
                    f"Quantity '{self.qty}' in '{self.qto}' must be > {self.min_exclusive} (found {val}).",
                    element_name=getattr(e, "Name", None),
                    path=f"Qto: {self.qto}.{self.qty}",
                    expected=f"> {self.min_exclusive}",
                    actual=str(val),
                ))
        return issues
