using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleRequireEqualStrings : IRule
{
    public string Id {get;}
    public Severity Severity {get;}

    private readonly string _ifcClass;
    private readonly string _psetA;
    private readonly string _keyA;
    private readonly string _psetB;
    private readonly string _keyB;

    public RuleRequireEqualStrings(
        string id,
        Severity severity,
        string ifcClass,
        string psetA,
        string keyA,
        string psetB,
        string keyB
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _psetA = psetA;
        _keyA = keyA;
        _psetB = psetB;
        _keyB = keyB;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances
            .OfType<IIfcProduct>()
            .Where(p => p.ExpressType?.Name?.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);
        
        foreach (var p in products)
        {
            var a = GetPropString(p, _psetA, _keyA);
            var b = GetPropString(p, _psetB, _keyB);

            if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b))
                continue;
            
            if (!string.Equals(a, b, StringComparison.OrdinalIgnoreCase))
            {
                yield return new Issue(
                    Id,
                    Severity,
                    _ifcClass,
                    p.GlobalId,
                    p.Name,
                    $"Mismatch: '{_psetA}.{_keyA}' = '{a}' but '{_psetB}.{_keyB}' = '{b}'."
                )
                .WithTrace(
                    path: $"{_psetA}.{_keyA} == {_psetB}.{_keyB}",
                    source: ValueSource.Derived,
                    expected: $"{_psetA}.{_keyA} = {_psetB}.{_keyB}",
                    actual: $"actual: {_psetA}.{_keyA}='{a}', {_psetB}.{_keyB}='{b}'"
                );
            }
        }
    }

    private static string? GetPropString(IIfcProduct p, string psetName, string keyName)
    {
        var ps = IfcPropertyUtils.GetAllPropertySets(p)
            .FirstOrDefault(x => x.Name?.ToString() == psetName);
        
        if (ps?.HasProperties == null) return null;

        var prop = ps.HasProperties.FirstOrDefault(hp => hp.Name.ToString() == keyName);
        var raw = (prop == null) ? null : IfcValueUtils.GetSingleValueAsString(prop);
        return raw?.Trim();
    }
}