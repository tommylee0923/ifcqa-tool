using IfcQa.Core.Rules;
using IfcQa.Core.Rules.Specs;

namespace IfcQa.Core.Rules.Factories;

public static class RuleFactory
{
    public static IRule Create(RuleSpec s)
    {
        var sev = Enum.TryParse<Severity>(s.Severity?.Trim(), true, out var parsed)
            ? parsed
            : Severity.Warning;

        if (string.IsNullOrWhiteSpace(s.Type))
            throw new RulesetValidationException("Rule missing 'type'.");

        if (string.IsNullOrWhiteSpace(s.Id))
            throw new RulesetValidationException($"Rule of type '{s.Type}' missing 'id'.");

        return s.Type switch
        {
            "MissingName" =>
                new RuleMissingName(
                    s.Id,
                    sev),

            "MissingContainment" =>
                new RuleMissingContainment(
                    s.Id,
                    sev),

            "DuplicateGlobalId" =>
                new RuleDuplicateGlobalId(
                    s.Id,
                    sev),

            "RequireNonEmpty" =>
                new RuleRequireNonEmpty(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Pset, "pset", s),
                    Req(s.Key, "key", s),
                    s.SkipIfMissing
                ),

            "AllowedValues" =>
                new RuleAllowedValues(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Pset, "pset", s),
                    Req(s.Key, "key", s),
                    ReqArr(s.AllowedValues, "allowedValues", s),
                    s.SkipIfMissing
                ),

            "RequirePset" =>
                new RuleRequirePset(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Pset, "pset", s)),

            "RequireAnyPset" =>
                new RuleRequireAnyPset(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    ReqArr(s.Psets, "psets", s)
                ),

            "RequirePsetPropertyKey" =>
                new RuleRequirePsetPropertyKey(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Pset, "pset", s),
                    Req(s.Key, "key", s)),

            "RequirePsetBool" =>
                new RuleRequirePsetPropertyValueBool(
                    s.Id, sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Pset, "pset", s),
                    Req(s.Key, "key", s)),

            "RequirePsetNumber" =>
                new RuleRequirePsetPropertyValueNumber(
                    s.Id, sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Pset, "pset", s),
                    Req(s.Key, "key", s),
                    s.MinExclusive ?? 0.0),

            "RequireQto" =>
                new RuleRequireQto(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Qto, "qto", s)),

            "RequireQtoQuantityNames" =>
                new RuleRequireQtoQuantityNames(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Qto, "qto", s),
                    s.QtyNames ?? Array.Empty<string>()),

            "RequireQtoQtyValue" =>
                new RuleRequireQtoQuantityValueNumber(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Qto, "qto", s),
                    Req(s.Qty, "qty", s),
                    s.MinExclusive ?? 0.0),

            "ComparePsetNumbers" =>
                new RuleComparePsetNumbers(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Pset, "pset", s),
                    Req(s.KeyA, "keyA", s),
                    Req(s.KeyB, "keyB", s)),

            "SpaceExternalHasExternalBoundary" =>
                new RuleSpaceExternalHasExternalBoundary(
                    s.Id,
                    sev),

            "WallVolumeImpliesLength" =>
                new RuleWallVolumeImpliesLength(
                    s.Id,
                    sev),

            "SurveyValue" => // Use this to survey values
                new RuleSurveyValue(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.Pset, "pset", s),
                    Req(s.Key, "key", s)
                ),

            "RequireEqualStrings" =>
                new RuleRequireEqualStrings(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    Req(s.PsetA, "psetA", s),
                    Req(s.KeyA, "keyA", s),
                    Req(s.PsetB, "psetB", s),
                    Req(s.KeyB, "keyB", s)
                ),

            "RequireNonEmptyAny" =>
                new RuleRequireNonEmptyAny(
                    s.Id,
                    sev,
                    Req(s.IfcClass, "ifcClass", s),
                    s.Attribute,            
                    s.Pset,                 
                    s.Key                   
                ),


            _ => throw new RulesetValidationException($"Unknown rule type: {s.Type}")
        };
    }

    static string Req(string? v, string field, RuleSpec s)
    {
        if (string.IsNullOrWhiteSpace(v))
            throw new RulesetValidationException($"Rule '{s.Id}' (type '{s.Type}') missing required field ' {field}'.");
        return v;
    }
    static string[] ReqArr(string[]? v, string field, RuleSpec s)
    {
        if (v == null || v.Length == 0)
            throw new RulesetValidationException($"Rule '{s.Id}' (type '{s.Type}') missing required field '{field}'.");
        return v;
    }

    static double ReqDouble(double? v, string field, RuleSpec s)
    {
        if (!v.HasValue)
            throw new RulesetValidationException($"Rule '{s.Id}' (type '{s.Type}') missing required field ' {field}'.");
        return v.Value;
    }
}