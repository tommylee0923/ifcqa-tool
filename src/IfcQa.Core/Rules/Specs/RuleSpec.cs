namespace IfcQa.Core.Rules.Specs;

public sealed class RuleSpec
{
    public string Type {get; set; } = "";
    public string Id {get; set; } = "";
    public string Severity {get; set;} = "Warning";

    public string? IfcClass {get; set;}
    public string? Pset {get; set;}
    public string[]? Psets {get; set;}
    public string? Key {get; set;}
    public string? KeyA {get; set;}
    public string? KeyB {get; set;}
    public string? Qto {get; set;}
    public string? Qty {get; set;}
    public string[]? QtyNames {get; set;}
    public double? MinExclusive {get; set;}
    public string[]? AllowedValues {get; set;}
    public string? Regex {get; set;}
}