namespace IfcQa.Core.Rules.Specs;

public sealed class RulesetSpec
{
    public string Name {get; set; } = "";
    public string Version {get; set;} = "";
    public List<RuleSpec> Rules {get; set;} = new();
}