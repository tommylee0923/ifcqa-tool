from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras

from infrastructure.psql_writer import _get_connection, _create_tables

# region Rule Types Seed Data
# ========================================================================
# RULE TYPES SEED DATA
# ========================================================================

RULE_TYPES = [
    {
        "name": "RequireNonEmpty",
        "description": "Checks that a specific property set key exists and is non-empty on an IFC element.",
        "required_fields": ["ifc_class", "pset", "key"],
        "optional_fields": ["skip_if_missing"],
    },
    {
        "name": "RequireNonEmptyAny",
        "description": "Checks that at least one of a direct attribute or pset key is non-empty.",
        "required_fields": ["ifc_class"],
        "optional_fields": ["attribute", "pset", "key"],
    },
    {
        "name": "RequireNonEmptyEither",
        "description": "Checks that at least one of two pset keys across two psets is non-empty.",
        "required_fields": ["ifc_class", "pset_a", "key_a", "pset_b", "key_b"],
        "optional_fields": ["skip_if_missing"],
    },
    {
        "name": "AllowedValues",
        "description": "Checks that a pset key value is one of a defined list of allowed values.",
        "required_fields": ["ifc_class", "pset", "key", "allowed_values"],
        "optional_fields": ["skip_if_missing"],
    },
    {
        "name": "RequireEqualStrings",
        "description": "Checks that two pset key values across two psets are equal strings.",
        "required_fields": ["ifc_class", "pset_a", "key_a", "pset_b", "key_b"],
        "optional_fields": ["skip_if_missing"],
    },
    {
        "name": "RegexMatch",
        "description": "Checks that a property value or direct attribute matches a regex pattern.",
        "required_fields": ["ifc_class", "regex"],
        "optional_fields": ["attribute", "pset", "key", "skip_if_missing"],
    },
    {
        "name": "RequirePset",
        "description": "Checks that a specific property set exists on an IFC element.",
        "required_fields": ["ifc_class", "pset"],
        "optional_fields": [],
    },
    {
        "name": "RequireAnyPset",
        "description": "Checks that at least one of a list of property sets exists on an IFC element.",
        "required_fields": ["ifc_class", "psets"],
        "optional_fields": [],
    },
    {
        "name": "RequirePsetPropertyKey",
        "description": "Checks that a specific key exists within a property set.",
        "required_fields": ["ifc_class", "pset", "key"],
        "optional_fields": [],
    },
    {
        "name": "RequirePsetBool",
        "description": "Checks that a pset key exists and holds a boolean value.",
        "required_fields": ["ifc_class", "pset", "key"],
        "optional_fields": [],
    },
    {
        "name": "RequirePsetNumber",
        "description": "Checks that a pset key exists and holds a number above a minimum threshold.",
        "required_fields": ["ifc_class", "pset", "key"],
        "optional_fields": ["min_exclusive"],
    },
    {
        "name": "ComparePsetNumbers",
        "description": "Checks that two numeric keys within the same pset are consistent.",
        "required_fields": ["ifc_class", "pset", "key_a", "key_b"],
        "optional_fields": [],
    },
    {
        "name": "SurveyValue",
        "description": "Checks that a pset key holds a valid survey value.",
        "required_fields": ["ifc_class", "pset", "key"],
        "optional_fields": [],
    },
    {
        "name": "RequireInstanceEqualsType",
        "description": "Checks that an instance-level pset value matches the corresponding type-level value.",
        "required_fields": ["ifc_class", "pset", "key"],
        "optional_fields": ["skip_if_missing"],
    },
    {
        "name": "RequireQto",
        "description": "Checks that a specific quantity set exists on an IFC element.",
        "required_fields": ["ifc_class", "qto"],
        "optional_fields": [],
    },
    {
        "name": "RequireQtoQuantityNames",
        "description": "Checks that a quantity set contains specific named quantities.",
        "required_fields": ["ifc_class", "qto", "qty_names"],
        "optional_fields": [],
    },
    {
        "name": "RequireQtoQuantityValueNumber",
        "description": "Checks that a specific quantity value is a number above a minimum threshold.",
        "required_fields": ["ifc_class", "qto", "qty"],
        "optional_fields": ["min_exclusive"],
    },
    {
        "name": "MissingName",
        "description": "Checks that an IFC element has a non-empty Name attribute.",
        "required_fields": ["ifc_class"],
        "optional_fields": [],
    },
    {
        "name": "DuplicateGlobalId",
        "description": "Checks that no two elements share the same GlobalId across the model.",
        "required_fields": [],
        "optional_fields": [],
    },
    {
        "name": "MissingContainment",
        "description": "Checks that an IFC element is assigned to a spatial container.",
        "required_fields": ["ifc_class"],
        "optional_fields": [],
    },
    {
        "name": "SpaceExternalHasExternalBoundary",
        "description": "Checks that external spaces have at least one external boundary relationship.",
        "required_fields": [],
        "optional_fields": [],
    },
    {
        "name": "WallVolumeImpliesLength",
        "description": "Checks that walls reporting a positive volume also report a length quantity.",
        "required_fields": [],
        "optional_fields": [],
    },
]

# region Seed Rule Types
# ========================================================================
# SEED RULE TYPES
# ========================================================================


def seed_rule_types(conn) -> None:
    """Seed the rule_types table. Skips types that already exist."""
    cursor = conn.cursor()

    for rt in RULE_TYPES:
        cursor.execute(
            """
                INSERT INTO rule_types (name, description, required_fields, optional_fields)
                VALUES (%s, %s, %s, %s)
                On CONFLICT (name) DO NOTHING
            """,
            (
                rt["name"],
                rt["description"],
                rt["required_fields"],
                rt["optional_fields"],
            ),
        )

    conn.commit()
    print(f"Seeded {len(RULE_TYPES)} rule types.")

# region Seed Rulesets
# ========================================================================
# SEED RULESETS
# ========================================================================

RULESET_DIR = Path(__file__).parent.parent.parent / "rulesets"

def seed_rulesets(conn) -> None:
    """
      Seed rulesets and rules from JSON files in the rulesets/ directory.
      Skips rulesets that already exist by name.
    """
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    json_files = list(RULESET_DIR.glob("*.json"))
    if not json_files:
        print("No ruleset JSON files found.")
        return
    
    seeded = 0
    skipped = 0
    
    for json_path in json_files:
        with open(json_path, "r") as f:
            data = json.load(f)
        
        name = data.get("name", json_path.stem)
        
        cursor.execute("SELECT id FROM rulesets WHERE name = %s", (name,))
        if cursor.fetchone():
            print(f"Skipping '{name}' - already exists.")
            skipped += 1
            continue
        
        cursor.execute(
            """
                INSERT INTO rulesets (name, version, description, source)
                VALUES (%s, %s, %s, 'built-in')
                RETURNING id
            """,
            (
                name,
                data.get("version"),
                data.get("description"),
            ),
        )
        ruleset_id = cursor.fetchone()["id"]
        
        rules = data.get("rules", [])
        rows = [_rule_to_row(ruleset_id, rule) for rule in rules]
        
        psycopg2.extras.execute_values(
            cursor,
            """
                INSERT INTO rules (
                    ruleset_id, rule_type, rule_id, severity, ifc_class, pset, key, psets, pset_a, key_a, pset_b, key_b, qto, qty, qty_names, min_exclusive, allowed_values, regex, attribute, skip_if_missing, meta_title, meta_why, meta_how_to_fix
                )
                VALUES %s
            """,
            rows,
        )
        
        conn.commit()
        print(f"Seeded '{name}' with {len(rules)} rules.")
        seeded += 1
    
    print(f"Done - {seeded} seeded, {skipped} skipped.")
    
    
def _rule_to_row(ruleset_id: int, rule: dict[str, Any]) -> tuple:
    """Map a JSON rule dict to a rules table row tuple."""
    meta = rule.get("meta", {})
    return (
        ruleset_id,
        rule.get("type"),
        rule.get("id"),
        rule.get("severity", "Warning"),
        rule.get("ifcClass"),
        rule.get("pset"),
        rule.get("key"),
        rule.get("psets") or None,
        rule.get("psetA"),
        rule.get("keyA"),
        rule.get("psetB"),
        rule.get("keyB"),
        rule.get("qto"),
        rule.get("qty"),
        rule.get("qtyNames") or None,
        rule.get("minExclusive"),
        rule.get("allowedValues") or None,
        rule.get("regex"),
        rule.get("attribute"),
        rule.get("skipIfMissing", False),
        meta.get("title"),
        meta.get("why"),
        meta.get("howToFix"),
    )

# endregion

# ========================================================================
# ENTRY POINT
# ========================================================================

def run_seed() -> None:
    conn = _get_connection()
    try:
        _create_tables(conn)
        conn.commit()
        seed_rule_types(conn)
        seed_rulesets(conn)
    finally:
        conn.close()