using IfcQa.Core.Rules.Specs;
using System.Runtime.Serialization;

namespace IfcQa.Core.Rules.Factories;

public static class RuleFactory
{
    public static IRule Create(RuleSpec s)
    {
        var sev = Enum.Parse<Severity>(s.Severity, ignoreCase: true);
        return s.Type switch
        {
            "MissingName" => new RuleMissingName(s.Id, sev),
            "MissingContanment" => new RuleMissingContainment(s.Id, sev),
            "DuplicateGlobalId" => new RuleDuplicateGlobalId(s.Id, sev),
            "RequirePset" => new RuleRequirePset(s.Id, sev, s.IfcClass!, s.Pset!),
            // Need to populate with more rules

            _ => throw new NotSupportedException($"Unknown rule type: {s.Type}")
        };
    }
}