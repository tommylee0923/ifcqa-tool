using QUT.Gppg;
using System.Reflection;
using System.Reflection.Metadata.Ecma335;
using System.Text.RegularExpressions;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;
using Xbim.IO.Esent;

namespace IfcQa.Core.Rules;

public sealed class RuleRegexMatch : IRule
{
    public string Id { get; }
    public Severity Severity { get; }

    private readonly string _ifcClass;
    private readonly string? _attribute;
    private readonly string? _pset;
    private readonly string? _key;
    private readonly Regex _regex;
    private readonly bool _skipIfMissing;

    public RuleRegexMatch(
        string id,
        Severity severity,
        string ifClass,
        string? attribute,
        string? pset,
        string? key,
        string pattern,
        bool skipIfMissing
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifClass;
        _attribute = attribute;
        _pset = pset;
        _key = key;
        _regex = new Regex(pattern, RegexOptions.Compiled);
        _skipIfMissing = skipIfMissing;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances
            .OfType<IIfcProduct>()
            .Where(p => p.ExpressType?.Name?.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);

        foreach (var p in products)
        {
            var val = GetValue(p);

            if (string.IsNullOrWhiteSpace(val))
            {
                if (_skipIfMissing) continue;

                yield return IssueTraceExtensions.Missing(
                    Id, 
                    Severity, 
                    _ifcClass, 
                    p.GlobalId, 
                    p.Name,
                    path: $"Attribute: {DescribeTarget()}",
                    source: ValueSource.Attribute,
                    message: $"{DescribeTarget()} is missing/empty.",
                    expected: "Non-empty",
                    actual: val ?? ""
                );

                continue;
            }

            if (!_regex.IsMatch(val))
            {
                yield return new Issue(
                    Id,
                    Severity,
                    _ifcClass,
                    p.GlobalId,
                    p.Name,
                    $"{DescribeTarget()} value '{val}' does not match regex '{_regex}'."
                )
                .WithTrace(
                    path: $"Attribute: {DescribeTarget()}",
                    source: ValueSource.Attribute,
                    expected: $"Regex: {_regex}",
                    actual: $"{val}"
                );
            }
        }
    }

    private string DescribeTarget() => !string.IsNullOrWhiteSpace(_attribute) ? $"Attribute '{_attribute}'" : $"Property '{_pset}.{_key}'";

    private string? GetValue(IIfcProduct p)
    {
        if (!string.IsNullOrWhiteSpace(_attribute))
            return GetAttributeString(p, _attribute);

        if (string.IsNullOrWhiteSpace(_pset) || string.IsNullOrWhiteSpace(_key))
            return null;

        var ps = IfcPropertyUtils.GetAllPropertySets(p)
            .FirstOrDefault(x => x.Name?.ToString() == _pset);

        if (ps?.HasProperties == null) return null;

        var prop = ps.HasProperties.FirstOrDefault(hp => hp.Name.ToString() == _key);
        return prop == null ? null : IfcValueUtils.GetSingleValueAsString(prop)?.Trim();
    }

    private static string? GetAttributeString(IIfcProduct p, string attribute)
    {
        var pi = p.GetType().GetProperty(attribute, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
        var raw = pi?.GetValue(p);
        return raw?.ToString()?.Trim();
    }
}