using System.Diagnostics.CodeAnalysis;

namespace IfcQa.Core;

public enum Severity { Info, Warning, Error }

public enum ValueSource
{
    Attribute,
    PsetInstance,
    PsetType,
    QtoInstance,
    QtoType,
    Derived,
    NotFound
}

public sealed record Issue(
    string RuleId,
    Severity Severity,
    string IfcClass,
    string GlobalId,
    string? Name,
    string Message
    )
{
    public string? Path { get; init; }
    public ValueSource? Source { get; init; }
    public string? Expected { get; init; }
    public string? Actual { get; init; }
}

public static class IssueTraceExtensions
{
    public static Issue WithTrace(
        this Issue issue,
        string path,
        ValueSource source,
        string? expected = null,
        string? actual = null
    ) => issue with
    {
        Path = path,
        Source = source,
        Expected = expected,
        Actual = actual
    };

    public static Issue Missing(
    string ruleId,
    Severity sev,
    string ifcClass,
    string globalId,
    string? name,
    string path,
    ValueSource source,
    string message,
    string expected = "Present",
    string actual = "Missing"
) => new Issue(
        ruleId,
        sev,
        ifcClass,
        globalId,
        name,
        message
    ).WithTrace(
        path,
        source,
        expected: expected,
        actual: actual
    );


    public static Issue InvalidValue(
        string ruleId,
        Severity sev,
        string ifcClass,
        string globalId,
        string? name,
        string path,
        ValueSource source,
        string expected,
        string? actual,
        string message)
        => new Issue(
            ruleId,
            sev,
            ifcClass,
            globalId,
            name,
            message)
            .WithTrace(
                path,
                source,
                expected: expected,
                actual: actual
                );
}