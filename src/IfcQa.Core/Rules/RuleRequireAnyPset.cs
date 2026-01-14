using IfcQa.Core;
using IfcQa.Core.Rules;
using Microsoft.Isam.Esent.Interop;
using Xbim.Ifc;
using Xbim.Ifc2x3.RepresentationResource;
using Xbim.Ifc4.Interfaces;

public sealed class RuleRequireAnyPset : IRule
{
    public string Id {get; }
    public Severity Severity {get; }

    private readonly string _ifcClass;
    private readonly string[] _psets;

    public RuleRequireAnyPset(
        string id,
        Severity severity,
        string ifcClass,
        string[] psets
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _psets = psets;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances 
            .OfType<IIfcProduct>()
            .Where(p => p.ExpressType?.Name == _ifcClass);
        
        foreach (var p in products)
        {
            bool hasAny = _psets.Any(ps => IfcPropertyUtils.GetAllPropertySets(p)
            .Any(x => x.Name?.ToString() == ps));

            if (!hasAny)
            {
                yield return new Issue(
                    Id,
                    Severity,
                    _ifcClass,
                    p.GlobalId,
                    p.Name,
                    $"Missing required property set: expected any of [{string.Join(",", _psets)}]."
                );
            }
        }
    }
}