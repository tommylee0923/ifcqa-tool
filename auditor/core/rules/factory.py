from __future__ import annotations

from core.rules.base import BaseRule
from core.rules.spec import RuleSpec
from core.rules.simple import (
    RuleRequireNonEmpty,
    RuleRequireNonEmptyAny,
    RuleRequireNonEmptyEither,
    RuleAllowedValues,
    RuleRequireEqualStrings,
    RuleRegexMatch,
    RuleRequirePset,
    RuleRequireAnyPset,
    RuleRequirePsetPropertyKey,
    RuleRequirePsetBool,
    RuleRequirePsetNumber,
    RuleComparePsetNumbers,
    RuleSurveyValue,
    RuleRequireInstanceEqualsType,
    RuleRequireQto,
    RuleRequireQtoQuantityNames,
    RuleRequireQtoQuantityValueNumber,
)


class RuleFactoryError(Exception):
    """Raised when a RuleSpec cannot be converted into a rule instance."""
    pass


def build_rule(spec: RuleSpec) -> BaseRule:
    """
    Convert a RuleSpec parsed from JSON into a concrete rule object.
    """

    rule_type = spec.type

    if rule_type == "RequireNonEmpty":
        _require(spec.ifc_class, spec.pset, spec.key, rule_type=rule_type)
        return RuleRequireNonEmpty(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.pset,
            spec.key,
            spec.skip_if_missing,
        )

    if rule_type == "RequireNonEmptyAny":
        _require(spec.ifc_class, rule_type=rule_type)
        return RuleRequireNonEmptyAny(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.attribute,
            spec.pset,
            spec.key,
        )

    if rule_type == "RequireNonEmptyEither":
        _require(spec.ifc_class, spec.pset_a, spec.key_a, spec.pset_b, spec.key_b, rule_type=rule_type)
        return RuleRequireNonEmptyEither(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.pset_a,
            spec.key_a,
            spec.pset_b,
            spec.key_b,
            spec.skip_if_missing,
        )

    if rule_type == "AllowedValues":
        _require(spec.ifc_class, spec.pset, spec.key, rule_type=rule_type)
        if not spec.allowed_values:
            raise RuleFactoryError(f"Rule '{spec.id}' requires allowedValues.")
        return RuleAllowedValues(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.pset,
            spec.key,
            spec.allowed_values,
            spec.skip_if_missing,
        )

    if rule_type == "RequireEqualStrings":
        _require(spec.ifc_class, spec.pset_a, spec.key_a, spec.pset_b, spec.key_b, rule_type=rule_type)
        return RuleRequireEqualStrings(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.pset_a,
            spec.key_a,
            spec.pset_b,
            spec.key_b,
            spec.skip_if_missing,
        )

    if rule_type == "RegexMatch":
        _require(spec.ifc_class, spec.regex, rule_type=rule_type)
        return RuleRegexMatch(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.regex,
            attribute=spec.attribute,
            pset=spec.pset,
            key=spec.key,
            skip_if_missing=spec.skip_if_missing,
        )

    if rule_type == "RequirePset":
        _require(spec.ifc_class, spec.pset, rule_type=rule_type)
        return RuleRequirePset(spec.id, spec.severity, spec.ifc_class, spec.pset)

    if rule_type == "RequireAnyPset":
        _require(spec.ifc_class, rule_type=rule_type)
        if not spec.psets:
            raise RuleFactoryError(f"Rule '{spec.id}' requires psets.")
        return RuleRequireAnyPset(spec.id, spec.severity, spec.ifc_class, spec.psets)

    if rule_type == "RequirePsetPropertyKey":
        _require(spec.ifc_class, spec.pset, spec.key, rule_type=rule_type)
        return RuleRequirePsetPropertyKey(spec.id, spec.severity, spec.ifc_class, spec.pset, spec.key)

    if rule_type == "RequirePsetBool":
        _require(spec.ifc_class, spec.pset, spec.key, rule_type=rule_type)
        return RuleRequirePsetBool(spec.id, spec.severity, spec.ifc_class, spec.pset, spec.key)

    if rule_type == "RequirePsetNumber":
        _require(spec.ifc_class, spec.pset, spec.key, rule_type=rule_type)
        return RuleRequirePsetNumber(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.pset,
            spec.key,
            spec.min_exclusive or 0.0,
        )

    if rule_type == "ComparePsetNumbers":
        _require(spec.ifc_class, spec.pset, spec.key_a, spec.key_b, rule_type=rule_type)
        return RuleComparePsetNumbers(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.pset,
            spec.key_a,
            spec.key_b,
        )

    if rule_type == "SurveyValue":
        _require(spec.ifc_class, spec.pset, spec.key, rule_type=rule_type)
        return RuleSurveyValue(spec.id, spec.severity, spec.ifc_class, spec.pset, spec.key)

    if rule_type == "RequireInstanceEqualsType":
        _require(spec.ifc_class, spec.pset, spec.key, rule_type=rule_type)
        return RuleRequireInstanceEqualsType(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.pset,
            spec.key,
            spec.skip_if_missing,
        )

    if rule_type == "RequireQto":
        _require(spec.ifc_class, spec.qto, rule_type=rule_type)
        return RuleRequireQto(spec.id, spec.severity, spec.ifc_class, spec.qto)

    if rule_type == "RequireQtoQuantityNames":
        _require(spec.ifc_class, spec.qto, rule_type=rule_type)
        if not spec.qty_name:
            raise RuleFactoryError(f"Rule '{spec.id}' requires qtyNames.")
        return RuleRequireQtoQuantityNames(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.qto,
            spec.qty_name,
        )

    if rule_type == "RequireQtoQuantityValueNumber":
        _require(spec.ifc_class, spec.qto, spec.qty, rule_type=rule_type)
        return RuleRequireQtoQuantityValueNumber(
            spec.id,
            spec.severity,
            spec.ifc_class,
            spec.qto,
            spec.qty,
            spec.min_exclusive or 0.0,
        )

    raise RuleFactoryError(f"Unknown rule type '{rule_type}' for rule '{spec.id}'.")


def build_rules(specs: list[RuleSpec]) -> list[BaseRule]:
    """
    Convert a list of RuleSpec objects into executable rule instances.
    """
    return [build_rule(spec) for spec in specs]


def _require(*values: object, rule_type: str) -> None:
    """
    Small validation helper for required constructor fields.
    """
    missing = [v for v in values if v is None or v == ""]
    if missing:
        raise RuleFactoryError(f"Rule type '{rule_type}' is missing required fields.")