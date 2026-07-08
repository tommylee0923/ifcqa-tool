from __future__ import annotations

import os
import json
import psycopg2
import psycopg2.extras
from typing import Any

# ========================================================================
# CONFIG
# ========================================================================

DB_CONFIG = {
    "host": os.environ.get("POSTGRES_HOST", "localhost"),
    "port": int(os.environ.get("POSTGRES_PORT", 5432)),
    "dbname": os.environ.get("POSTGRES_DB", "ifcqa"),
    "user": os.environ.get("POSTGRES_USER", "ifcqa"),
    "password": os.environ.get("POSTGRES_PASSWORD", "ifcqa123"),
}

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# ========================================================================
# DATABASE
# ========================================================================

def _get_connection():
    return psycopg2.connect(**DB_CONFIG)


def _fetch_rule_types() -> list[dict[str, Any]]:
    """Read all rule types from the rule_types table."""
    conn = _get_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            """
            SELECT name, description, required_fields, optional_fields
            FROM rule_types
            ORDER BY name ASC
            """
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

# ========================================================================
# PROMPT CONSTRUCTION
# ========================================================================

def _build_system_prompt(rule_types: list[dict[str, Any]]) -> str:
    """
    Dynamically build the system prompt by embedding the full rule type
    vocabulary sourced from the database.
    """
    vocabulary_lines = []
    for rt in rule_types:
        line = f"- {rt['name']}: {rt['description']}"
        if rt["required_fields"]:
            line += f"\n  Required fields: {', '.join(rt['required_fields'])}"
        if rt["optional_fields"]:
            line += f"\n  Optional fields: {', '.join(rt['optional_fields'])}"
        vocabulary_lines.append(line)

    vocabulary_block = "\n".join(vocabulary_lines)

    return f"""You are an IFC model quality assurance rule generator.

Your job is to generate a JSON array of validation rules based on the user's description.

STRICT CONSTRAINTS:
- You may ONLY use rule types from the vocabulary list below. Do not invent new types.
- Every rule must include all required fields listed for its type.
- Output must be a valid JSON array and nothing else. No explanation, no markdown, no code fences.
- All field names must be camelCase.

FIELDS PRESENT IN EVERY RULE:
- type: the rule type name, must match the vocabulary exactly
- id: a short unique identifier string, e.g. "GEN-001"
- severity: one of "Error", "Warning", or "Info"

OPTIONAL METADATA (include on every rule):
- meta.title: short human-readable title
- meta.why: why this check matters on a real project
- meta.howToFix: how an engineer should resolve a failure

FIELD NAME REFERENCE (camelCase):
- ifcClass, pset, key, psets, psetA, keyA, psetB, keyB
- qto, qty, qtyNames, minExclusive, allowedValues
- regex, attribute, skipIfMissing

RULE TYPE VOCABULARY:
{vocabulary_block}

OUTPUT FORMAT EXAMPLE:
[
  {{
    "type": "RequireNonEmpty",
    "id": "GEN-001",
    "severity": "Warning",
    "ifcClass": "IfcSpace",
    "pset": "PSet_Revit_Identity Data",
    "key": "Number",
    "meta": {{
      "title": "Space must have a room number",
      "why": "Room numbers are required for space scheduling and FM handover.",
      "howToFix": "Set the Number property in the Identity Data property set in Revit."
    }}
  }}
]"""

# ========================================================================
# API CALL
# ========================================================================

def _call_anthropic(system_prompt: str, user_description: str) -> str:
    """Call the Anthropic API and return the raw text response."""
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_description}
        ],
    )

    return message.content[0].text


def _parse_rules(raw: str) -> list[dict[str, Any]]:
    """
    Parse the raw LLM response into a list of rule dicts.
    Strips markdown fences defensively in case the model includes them.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1]).strip()

    return json.loads(cleaned)

# ========================================================================
# VALIDATION
# ========================================================================

def _validate_rules(
    rules: list[dict[str, Any]],
    rule_types: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    """
    Validate LLM-generated rules against the known rule type vocabulary.

    Checks:
    - rule type exists in the vocabulary
    - all required fields for that type are present and non-null

    Returns:
        valid_rules: rules that passed all checks
        errors: human-readable error strings for any rules that failed
    """
    vocab: dict[str, list[str]] = {
        rt["name"]: rt["required_fields"] or []
        for rt in rule_types
    }

    valid_rules: list[dict[str, Any]] = []
    errors: list[str] = []

    for i, rule in enumerate(rules):
        rule_id = rule.get("id", f"rule[{i}]")
        rule_type = rule.get("type")

        if rule_type not in vocab:
            errors.append(
                f"{rule_id}: unknown rule type '{rule_type}'. "
                f"Must be one of: {', '.join(sorted(vocab.keys()))}"
            )
            continue

        missing = [
            f for f in vocab[rule_type]
            if rule.get(f) is None and rule.get(f) != 0
        ]
        if missing:
            errors.append(
                f"{rule_id} ({rule_type}): missing required fields: {', '.join(missing)}"
            )
            continue

        valid_rules.append(rule)

    return valid_rules, errors

# ========================================================================
# PUBLIC ENTRY POINT
# ========================================================================

def generate_ruleset(description: str) -> tuple[list[dict[str, Any]], list[str]]:
    """
    Takes a natural language description, calls the LLM, validates the output,
    and returns (valid_rules, errors).

    - valid_rules: list of rule dicts that passed vocabulary + required-field checks
    - errors: list of human-readable strings for any rules that failed validation

    Retries once with a corrective nudge if the response is not valid JSON.
    Raises ValueError if both parse attempts fail.
    If any rules fail validation, the entire batch is rejected and errors are returned
    with an empty valid_rules list — no partial saves.
    """
    rule_types = _fetch_rule_types()
    system_prompt = _build_system_prompt(rule_types)

    last_error: Exception | None = None

    for attempt in range(2):
        try:
            raw = _call_anthropic(system_prompt, user_description=description)
            rules = _parse_rules(raw)
            break
        except (json.JSONDecodeError, IndexError) as e:
            last_error = e
            if attempt == 0:
                description = (
                    description
                    + "\n\nIMPORTANT: Your previous response could not be parsed. "
                    "Return only a valid JSON array. No explanation, no markdown, no code fences."
                )
    else:
        raise ValueError(
            f"Failed to generate valid JSON after 2 attempts. Last error: {last_error}"
        )

    valid_rules, errors = _validate_rules(rules, rule_types)

    # Reject the entire batch if any rule fails validation
    if errors:
        return [], errors

    return valid_rules, []