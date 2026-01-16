using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleRequireNonEmpty : IRule
{
    public string Id { get; }
    public Severity Severity { get; }

    private readonly string _ifcClass;
    private readonly string _pset;
    private readonly string _key;
    private readonly bool _skipIfMissing;

    public RuleRequireNonEmpty(
        string id,
        Severity severity,
        string ifcClass,
        string pset,
        string key,
        bool skipIfMissing
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _pset = pset;
        _key = key;
        _skipIfMissing = skipIfMissing;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances
            .OfType<IIfcProduct>()
            .Where(p => p.ExpressType?.Name?.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);

        foreach (var p in products)
        {
            var ps = IfcPropertyUtils.GetAllPropertySets(p)
                .FirstOrDefault(x => x.Name?.ToString() == _pset);

            if (ps == null)
            {
                if (_skipIfMissing) continue;

                yield return new Issue(
                    Id, Severity, _ifcClass, p.GlobalId, p.Name,
                    $"Missing property set '{_pset}' (required for '{_key}')."
                );
                continue;
            }

            var prop = ps.HasProperties?.FirstOrDefault(hp => hp.Name.ToString() == _key);
            if (prop == null)
            {
                if (_skipIfMissing) continue;

                yield return new Issue(
                    Id, Severity, _ifcClass, p.GlobalId, p.Name,
                    $"Missing property '{_key}' in '{_pset}'."
                );
                continue;
            }

            var raw = IfcValueUtils.GetSingleValueAsString(prop);
            if (string.IsNullOrWhiteSpace(raw))
            {
                if (_skipIfMissing) continue;

                yield return new Issue(
                    Id, Severity, _ifcClass, p.GlobalId, p.Name,
                    $"Property '{_pset}.{_key}' must not be empty."
                );
            }
        }
    }
}
