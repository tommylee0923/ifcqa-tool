from __future__ import annotations

from collections import Counter
import ifcopenshell

from core.model import IssueRecord
from core.context import AuditContext
from core.rules.base import BaseRule
from core.rules.pset_utils import get_psets, get_qto_value


SKIP_NAME_CLASSES = {"IfcAnnotation", "IfcOpeningElement"}


def _elements_of_class(context: AuditContext, ifc_class: str):
    return context.get_elements(ifc_class)


class RuleMissingName(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues: list[IssueRecord] = []

        for e in _elements_of_class(context, self.ifc_class):
            if e.is_a() in SKIP_NAME_CLASSES:
                continue

            name = getattr(e, "Name", None)
            if name is None or str(name).strip() == "":
                issues.append(self._issue(
                    e.GlobalId,
                    e.is_a(),
                    f"{e.is_a()} is missing a Name value.",
                    element_name=name,
                    path="Name",
                    expected="Non-empty",
                    actual=name or "",
                ))

        return issues


class RuleDuplicateGlobalId(BaseRule):
    def __init__(self, rule_id: str, severity: str):
        super().__init__(rule_id, severity)

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues: list[IssueRecord] = []

        roots = context.all_roots
        ids = [getattr(e, "GlobalId", None) for e in roots if getattr(e, "GlobalId", None)]
        counts = Counter(ids)
        duplicate_ids = {gid for gid, count in counts.items() if count > 1}

        for e in roots:
            raw_gid = getattr(e, "GlobalId", None)

            if not isinstance(raw_gid, str) or raw_gid.strip() == "":
                continue

            gid = raw_gid

            if gid in duplicate_ids:
                issues.append(self._issue(
                    gid,
                    e.is_a(),
                    f"Duplicate GlobalId found: {gid}.",
                    element_name=getattr(e, "Name", None),
                    path="GlobalId",
                    expected="Unique GlobalId",
                    actual=gid,
                ))

        return issues


class RuleMissingContainment(BaseRule):
    def __init__(self, rule_id: str, severity: str, ifc_class: str):
        super().__init__(rule_id, severity)
        self.ifc_class = ifc_class

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues: list[IssueRecord] = []

        for e in _elements_of_class(context, self.ifc_class):
            contained = getattr(e, "ContainedInStructure", None)

            if not contained:
                issues.append(self._issue(
                    e.GlobalId,
                    e.is_a(),
                    f"{e.is_a()} is not contained in a spatial structure.",
                    element_name=getattr(e, "Name", None),
                    path="ContainedInStructure",
                    expected="IfcRelContainedInSpatialStructure",
                    actual="Missing",
                ))

        return issues


class RuleSpaceExternalHasExternalBoundary(BaseRule):
    def __init__(self, rule_id: str, severity: str):
        super().__init__(rule_id, severity)

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues: list[IssueRecord] = []

        for space in context.get_elements("IfcSpace"):
            is_external = _is_external_space(space)
            if not is_external:
                continue

            boundaries = getattr(space, "BoundedBy", None)
            if not boundaries:
                issues.append(self._issue(
                    space.GlobalId,
                    space.is_a(),
                    "External IfcSpace has no space boundary relationships.",
                    element_name=getattr(space, "Name", None),
                    path="BoundedBy",
                    expected="At least one boundary relationship",
                    actual="Missing",
                ))

        return issues


class RuleWallVolumeImpliesLength(BaseRule):
    def __init__(self, rule_id: str, severity: str):
        super().__init__(rule_id, severity)

    def evaluate(self, context: AuditContext) -> list[IssueRecord]:
        issues: list[IssueRecord] = []

        for wall in context.get_elements("IfcWall"):
            volume = get_qto_value(wall, "Qto_WallBaseQuantities", "NetVolume")
            length = get_qto_value(wall, "Qto_WallBaseQuantities", "Length")

            if volume is None:
                continue

            try:
                volume_num = float(volume)
            except (TypeError, ValueError):
                continue

            if volume_num <= 0:
                continue

            if length is None:
                issues.append(self._issue(
                    wall.GlobalId,
                    wall.is_a(),
                    "Wall has positive NetVolume but missing Length quantity.",
                    element_name=getattr(wall, "Name", None),
                    path="Qto_WallBaseQuantities.Length",
                    expected="Length > 0 when NetVolume > 0",
                    actual="Missing",
                ))
                continue

            try:
                length_num = float(length)
            except (TypeError, ValueError):
                issues.append(self._issue(
                    wall.GlobalId,
                    wall.is_a(),
                    "Wall Length quantity is not numeric.",
                    element_name=getattr(wall, "Name", None),
                    path="Qto_WallBaseQuantities.Length",
                    expected="Numeric length > 0",
                    actual=str(length),
                ))
                continue

            if length_num <= 0:
                issues.append(self._issue(
                    wall.GlobalId,
                    wall.is_a(),
                    "Wall has positive NetVolume but non-positive Length.",
                    element_name=getattr(wall, "Name", None),
                    path="Qto_WallBaseQuantities.Length",
                    expected="Length > 0 when NetVolume > 0",
                    actual=str(length_num),
                ))

        return issues


def _is_external_space(space) -> bool:
    psets = get_psets(space)

    for pset_name in ("Pset_SpaceCommon", "PSet_Revit_Identity Data", "PSet_Revit_Other"):
        pset = psets.get(pset_name)
        if not pset:
            continue

        for key in ("IsExternal", "External", "Is External"):
            value = pset.get(key)
            if _truthy(value):
                return True

    return False


def _truthy(value) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    return str(value).strip().lower() in {"true", "1", "yes", "y"}