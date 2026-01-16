using System.Reflection;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleRequireNonEmptyAny : IRule
{
    public string Id {get;}
    public Severity Severity {get;}

    private readonly string _ifcClass;
    private readonly string? _attribute;
    private readonly string? _pset;
    private readonly string? _key;

    public RuleRequireNonEmptyAny(
        string id,
        Severity severity,
        string ifcClass,
        string? attribute,
        string? pset,
        string? key
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _attribute = attribute;
        _pset = pset;
        _key = key;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances
            .OfType<IIfcProduct>()
            .Where(p => p.ExpressType?.Name == _ifcClass);
        
        foreach (var p in products)
        {
            var attrVal = GetAttributeString(p, _attribute);
            if (!string.IsNullOrWhiteSpace(attrVal)) continue;

            var psetVal = GetPsetKeyString(p, _pset, _key);
            if (!string.IsNullOrWhiteSpace(psetVal)) continue;

            yield return new Issue(
                Id,
                Severity,
                _ifcClass,
                p.GlobalId,
                p.Name,
                $"Expectd non-empty value in either attribute '{_attribute}' or '{_pset}.{_key}'."
            );
        }
    }

    private static string? GetAttributeString(IIfcProduct p, string? attr)
    {
        if (string.IsNullOrWhiteSpace(attr)) return null;

        var pi = p.GetType().GetProperty(attr, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
        var val = pi?.GetValue(p);
        return val?.ToString()?.Trim();
    }

    private static string? GetPsetKeyString(IIfcProduct p, string? psetName, string? keyName)
    {
        if (string.IsNullOrWhiteSpace(psetName) || string.IsNullOrWhiteSpace(keyName)) return null;

        var ps = IfcPropertyUtils.GetAllPropertySets(p)
            .FirstOrDefault(x => x.Name?.ToString() == psetName);
        
        if (ps?.HasProperties == null) return null;

        var prop = ps.HasProperties.FirstOrDefault(hp => hp.Name.ToString() == keyName);
        if (prop == null) return null;

        return IfcValueUtils.GetSingleValueAsString(prop)?.Trim();
    }
}