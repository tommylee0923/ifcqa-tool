using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleRequireInstanceEqualsType : IRule
{
    public string Id {get;}
    public Severity Severity {get;}

    private readonly string _ifcClass;
    private readonly string _pset;
    private readonly string _key;
    private readonly bool _skipIfMissing;

    public RuleRequireInstanceEqualsType(
        string id,
        Severity severity,
        string ifcClass,
        string pset,
        string key,
        bool skipIsMissing
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _pset = pset;
        _key = key;
        _skipIfMissing = skipIsMissing;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances
            .OfType<IIfcProduct>()
            .Where(p => p.ExpressType.Name.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);
        
        foreach (var p in products)
        {
            var instVal = GetValueFromPsets(IfcPropertyUtils.GetInstancePropertySets(p), _pset, _key);
            var typeVal = GetValueFromPsets(IfcPropertyUtils.GetTypePropertySets(p), _pset, _key);

            if (string.IsNullOrWhiteSpace(typeVal) || string.IsNullOrWhiteSpace(instVal))
            {
                if (_skipIfMissing) continue;
                continue;
            }

            if (!string.Equals(instVal, typeVal, StringComparison.OrdinalIgnoreCase))
            {
                yield return new Issue(
                    Id,
                    Severity,
                    _ifcClass,
                    p.GlobalId,
                    p.Name,
                    $"Instance '{_pset}.{_key}' = '{instVal}' differs from Type '{_pset}.{_key}' = '{typeVal}'."
                )
                .WithTrace(
                    path: $"Instance:{_pset}.{_key} == Type:{_pset}.{_key}",
                    source: ValueSource.Derived,
                    expected: typeVal,
                    actual: instVal
                );
            }
        }
    }

    private static string? GetValueFromPsets(IEnumerable<IIfcPropertySet> psets, string psetName, string keyName)
    {
        var ps = psets.FirstOrDefault(x => x.Name?.ToString() == psetName);
        if (ps?.HasProperties == null) return null;

        var prop = ps.HasProperties.FirstOrDefault(hp => hp.Name.ToString() == keyName);
        return prop == null ? null : IfcValueUtils.GetSingleValueAsString(prop)?.Trim();
    }
}