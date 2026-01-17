using System.Data.Common;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleRequireNonEmptyEither : IRule
{
    public string Id {get;}
    public Severity Severity {get;}

    private readonly string _ifcClass;
    private readonly string _psetA;
    private readonly string _keyA;
    private readonly string _psetB;
    private readonly string _keyB;
    private readonly bool _skipIfMissing;

    public RuleRequireNonEmptyEither(
        string id,
        Severity severity,
        string ifcClass,
        string psetA,
        string keyA,
        string psetB,
        string keyB,
        bool skipIfMissing
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _psetA = psetA;
        _keyA = keyA;
        _psetB = psetB;
        _keyB = keyB;
        _skipIfMissing = skipIfMissing;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances
            .OfType<IIfcProduct>()
            .Where(p => p.ExpressType.Name?.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);
        
        foreach (var p in products)
        {
            var a = GetPropString(p, _psetA, _keyA);
            var b = GetPropString(p, _psetB, _keyB);

            if (!string.IsNullOrWhiteSpace(a) || !string.IsNullOrWhiteSpace(b))
                continue;
            
            if (_skipIfMissing)
            {
                var aExists = ExistsPsetOrKey(p, _psetA, _keyA);
                var bExists = ExistsPsetOrKey(p, _psetB, _keyB);
                if (!aExists && !bExists) continue;
            }

            yield return new Issue(
                Id,
                Severity,
                _ifcClass,
                p.GlobalId,
                p.Name,
                $"Expected non-empty value in either '{_psetA}.{_keyA}' or '{_psetB}.{_keyB}'."
            );
        }
    }

    private static string? GetPropString(IIfcProduct p, string psetName, string keyName)
    {
        var ps = IfcPropertyUtils.GetAllPropertySets(p)
            .FirstOrDefault(x => x.Name?.ToString() == psetName);
        
        if (ps?.HasProperties == null) return null;

        var prop = ps.HasProperties.FirstOrDefault(hp => hp.Name.ToString() == keyName);
        return prop == null? null : IfcValueUtils.GetSingleValueAsString(prop)?.Trim();
    }

    private static bool ExistsPsetOrKey(IIfcProduct p, string psetName, string keyName)
    {
        var ps = IfcPropertyUtils.GetAllPropertySets(p)
            .FirstOrDefault(x => x.Name?.ToString() == psetName);
        
        if (ps == null) return false;
        if (ps.HasProperties == null) return true;
        return ps.HasProperties.Any(hp => hp.Name.ToString() == keyName);
    }
}