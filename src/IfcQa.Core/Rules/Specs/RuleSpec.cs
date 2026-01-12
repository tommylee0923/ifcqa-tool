namespace IfcQa.Core.Rules.Specs;

public sealed class RuleSpec
{
    public string Type {get; set; } = "";
    public string Id {get; set; } = "";
    public string Severity {get; set;} = "";

    public string? IfcClass {get; set;}
    public string? Pset {get; set;}
    public string? Key {get; set;}
    public string? Qto {get; set;}
    public string? Qty {get; set;}
    public string? MinExclusive {get; set;}
}