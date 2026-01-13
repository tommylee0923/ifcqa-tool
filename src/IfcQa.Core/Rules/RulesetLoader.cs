using System.Text.Json;
using IfcQa.Core.Rules.Factories;
using IfcQa.Core.Rules.Specs;

namespace IfcQa.Core.Rules;

public static class RulesetLoader
{
    public static (RulesetSpec spec, IRule[] rules) Load(string rulesetPath)
    {
        if (!File.Exists(rulesetPath))
            throw new FileNotFoundException($"Ruleset not found: {rulesetPath}");
        
        var json = File.ReadAllText(rulesetPath);
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        var spec = JsonSerializer.Deserialize<RulesetSpec>(json, options)
            ?? throw new InvalidOperationException("Failed to parse ruleset JSON.");

        ValidateRuleset(spec);

        var rules = spec.Rules.Select(RuleFactory.Create).ToArray();
        return (spec, rules);
    }

    static void ValidateRuleset(RulesetSpec spec)
    {
        if (string.IsNullOrWhiteSpace(spec.Name))
            throw new RulesetValidationException("RulesetSpec.Name is required.");

        if (string.IsNullOrWhiteSpace(spec.Version))
            throw new RulesetValidationException("RulesetSpec.Version is required.");

        if (spec.Rules == null || spec.Rules.Count == 0)
            throw new RulesetValidationException("RulesetSpec.Rules must contain at least one rule.");
        
        var dupes = spec.Rules 
            .Where(r => !string.IsNullOrWhiteSpace(r.Id))
            .GroupBy(r => r.Id)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();
        
        if (dupes.Count > 0)
            throw new RulesetValidationException($"Duplicate rule ids: {string.Join(",", dupes)}");
        
        foreach (var r in spec.Rules)
        {
            if (string.IsNullOrWhiteSpace(r.Id))
                throw new RulesetValidationException("A rule is missing required field 'id'.");
            
            if (string.IsNullOrWhiteSpace(r.Type))
                throw new RulesetValidationException($"Rule '{r.Id}' is missing required field 'type'.");
        }
    }
}