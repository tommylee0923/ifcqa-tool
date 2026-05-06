from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class RuleSpec:
    """
    Raw data parsed from a single rule entry in a ruleset JSON file.
    All fields are optional except type, id, and severity.
    """

    type: str
    id: str
    severity: str = "Warning"
    ifc_class: str | None = None

    # Single pset fields
    pset: str | None = None
    key: str | None = None

    # Multi-pset fields
    psets: list[str] = field(default_factory=list)

    # Cross-pset comparison fields
    pset_a: str | None = None
    key_a: str | None = None
    pset_b: str | None = None
    key_b: str | None = None

    # Quantity set fields
    qto: str | None = None
    qty: str | None = None
    qty_name: list[str] = field(default_factory=list)

    # Numeric threshold
    min_exclusive: float | None = None

    # Allowed values list
    allowed_values: list[str] = field(default_factory=list)

    # Regex pattern
    regex: str | None = None

    # Direct IFC attribute as alternative to pset lookup
    attribute: str | None = None

    # Behavior flags
    skip_if_missing: bool = False
    require_both_present: bool = False

    # Rule metadata (informational only)
    meta: dict = field(default_factory=dict)


@dataclass
class RulesetSpec:
    """
    The top-level ruleset parsed from a JSON file.
    """

    name: str
    version: str
    rules: list[RuleSpec]
    description: str = ""
