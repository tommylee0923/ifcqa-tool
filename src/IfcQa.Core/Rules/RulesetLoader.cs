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

        var rules = spec.Rules.Select(RuleFactory.Create).ToArray();
        return (spec, rules);
    }
}