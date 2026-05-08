namespace IfcQa.Core.Rules.Specs;

public sealed class RulesetValidationException : Exception
{
    public RulesetValidationException(string message) : base(message) { }
}