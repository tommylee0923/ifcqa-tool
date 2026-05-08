using System.Diagnostics.CodeAnalysis;
using System.Diagnostics.Tracing;
using System.Runtime.Serialization;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleAllowedValues : IRule
{
    public string Id { get; }
    public Severity Severity { get; }

    private readonly string _ifcClass;
    private readonly string _pset;
    private readonly string _key;
    private readonly HashSet<string> _allowed;
    private readonly bool _skipIfMissing;

    public RuleAllowedValues(
        string id,
        Severity severity,
        string ifcClass,
        string pset,
        string key,
        IEnumerable<string> allowedValues,
        bool skipIfMissing
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _pset = pset;
        _key = key;
        _allowed = new HashSet<String>(allowedValues.Select(Norm));
        _skipIfMissing = skipIfMissing;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances
            .OfType<IIfcProduct>()
            .Where(p => p.ExpressType?.Name.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);

        foreach (var p in products)
        {
            var psets = IfcPropertyUtils.GetAllPropertySets(p);

            var ps = psets.FirstOrDefault(x => x.Name?.ToString() == _pset);
            if (ps == null)
            {
                if (_skipIfMissing) continue;
               yield return IssueTraceExtensions.Missing(
                    Id, 
                    Severity,
                    _ifcClass, 
                    p.GlobalId, 
                    p.Name,
                    path: _pset,
                    source: ValueSource.PsetInstance,
                    message: $"Missing property set '{_pset}' (required for '{_key}')."
                    );
                continue;
            }

            var prop = ps.HasProperties?.FirstOrDefault(hp => hp.Name.ToString() == _key);
            if (prop == null)
            {
                if (_skipIfMissing) continue;
                yield return IssueTraceExtensions.Missing(
                    Id,
                    Severity,
                    _ifcClass,
                    p.GlobalId,
                    p.Name,
                    path: _pset,
                    source: ValueSource.PsetInstance,
                    message: $"Missing property '{_key}' in '{_pset}'."
                    );
                continue;
            }

            var val = Norm(IfcValueUtils.GetSingleValueAsString(prop));
            if (string.IsNullOrWhiteSpace(val))
            {
                if (_skipIfMissing) continue;
                yield return IssueTraceExtensions.InvalidValue(
                    Id,
                    Severity,
                    _ifcClass,
                    p.GlobalId,
                    p.Name,
                    path: $"{_pset}.{_key}",
                    source: ValueSource.PsetInstance,
                    expected: "Non-empty",
                    actual: val,
                    message: $"Property '{_pset}.{_key}' must not be empty."
                    );
                continue;
            }

            if (!_allowed.Contains(val))
            {
                yield return IssueTraceExtensions.InvalidValue(
                    Id, Severity, _ifcClass, p.GlobalId, p.Name,
                    path: $"{_pset}.{_key}",
                    source: ValueSource.PsetInstance,
                    expected: $"One of: {string.Join(", ", _allowed)}",
                    actual: val,
                    message: $"Property '{_pset}.{_key}' has value '{val}', expected one of [{string.Join(",", _allowed)}]."
                    );
                continue;
            }
        }
    }

    private static string Norm(string? s) => (s ?? "").Trim();
}