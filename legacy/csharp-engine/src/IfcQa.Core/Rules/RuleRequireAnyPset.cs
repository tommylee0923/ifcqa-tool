using IfcQa.Core;
using IfcQa.Core.Rules;
using Microsoft.Isam.Esent.Interop;
using Xbim.Ifc;
using Xbim.Ifc2x3.RepresentationResource;
using Xbim.Ifc4.Interfaces;

public sealed class RuleRequireAnyPset : IRule
{
    public string Id { get; }
    public Severity Severity { get; }

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
            .Where(p => p.ExpressType?.Name?.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);

        foreach (var p in products)
        {
            var all = IfcPropertyUtils.GetAllPropertySets(p);
            bool hasAny = _psets.Any(ps => all.Any(x => x.Name?.ToString() == ps));


            if (!hasAny)
            {
                yield return IssueTraceExtensions.Missing(
                    Id,
                    Severity,
                    _ifcClass,
                    p.GlobalId,
                    p.Name,
                    path: $"AnyPset: [{string.Join(",", _psets)}]",
                    source: ValueSource.Derived,
                    message: $"Missing required property set."
                );
            }
        }
    }
}