namespace IfcQa.Core;

public enum Severity { Info, Warning, Error }

public sealed record Issue(
    string RuleId,
    Severity Severity,
    string IfcClass,
    string GlobalId,
    string? Name,
    string Message
    );