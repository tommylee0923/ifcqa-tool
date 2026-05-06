from __future__ import annotations
import json
from pathlib import Path
from core.rules.spec import RuleSpec, RulesetSpec

class RulesetValidationError(Exception):
    """Raised when a ruleset JSON fails structural validation."""
    pass

def load_ruleset(ruleset_path: str) -> RulesetSpec:
    """
    Parse and validate a ruleset JSON file.
    Returns a RulesetSpec on success, raises RulesetValidationError on failure.
    """

    path = Path(ruleset_path)
    if not path.exists():
        raise FileNotFoundError(f"Ruleset not found: {ruleset_path}")
    
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    ruleset = _parse_ruleset(data, ruleset_path)
    _validate_ruleset(ruleset, ruleset_path)
    return ruleset

# ========================================================================
# PARSING
# ========================================================================

def _parse_ruleset(data: dict, source: str) -> RulesetSpec:
    try:
        rules = [_parse_rule(r) for r in data.get("rules", [])]
        return RulesetSpec(
            name=data.get("name", ""),
            version=data.get("version", ""),
            rules=rules,
            description=data.get("description", ""),
        )
    except (KeyError, TypeError) as e:
        raise RulesetValidationError(f"Failed to parse ruleset '{source}': {e}") from e

def _parse_rule(r: dict) -> RuleSpec:
    """
    Map a raw JSON rule dict to  RuleSpec dataclass.
    Handles camelCase JSON keys → snake_case Python fields.
    unknown keys are silently ignored so rulesets can carry extra metadata without breaking the loader.
    """
    return RuleSpec(
        type=r.get("type", ""),
        id=r.get("id", ""),
        severity=r.get("severity", "Warning"),
        ifc_class=r.get("ifcClass"),
 
        pset=r.get("pset"),
        key=r.get("key"),
 
        psets=r.get("psets") or [],
 
        pset_a=r.get("psetA"),
        key_a=r.get("keyA"),
        pset_b=r.get("psetB"),
        key_b=r.get("keyB"),
 
        qto=r.get("qto"),
        qty=r.get("qty"),
        qty_name=r.get("qtyNames") or [],
 
        min_exclusive=r.get("minExclusive"),
 
        allowed_values=r.get("allowedValues") or [],
 
        regex=r.get("regex"),
        attribute=r.get("attribute"),
 
        skip_if_missing=r.get("skipIfMissing", False),
        require_both_present=r.get("requireBothPresent", False),
 
        meta=r.get("meta") or {},
    )

# ========================================================================
# VALIDATION
# ========================================================================

def _validate_ruleset(spec: RulesetSpec, source: str) -> None:
    """
    Structural validation
    Raises RulesetValidationError describing the first problem found.
    """

    if not spec.name.strip():
        raise RulesetValidationError(f"Ruleset '{source}': 'name' is required.")
    
    if not spec.version.strip():
        raise RulesetValidationError(f"Ruleset '{source}': 'version' is required.")
 
    if not spec.rules:
        raise RulesetValidationError(f"Ruleset '{source}': must contain at least one rule.")
 
    for rule in spec.rules:
        if not rule.id.strip():
            raise RulesetValidationError(
                f"Ruleset '{source}': a rule of type '{rule.type}' is missing 'id'."
            )
        if not rule.type.strip():
            raise RulesetValidationError(
                f"Ruleset '{source}': rule '{rule.id}' is missing 'type'."
            )
    
    # Duplicate ID check
    seen: set[str] = set()
    dupes: list[str] = []
    for rule in spec.rules:
        if rule.id in seen:
            dupes.append(rule.id)
        seen.add(rule.id)

    if dupes:
        raise RulesetValidationError(
            f"Ruleset '{source}': duplicate rules ids: {', '.join(dupes)}"
        )