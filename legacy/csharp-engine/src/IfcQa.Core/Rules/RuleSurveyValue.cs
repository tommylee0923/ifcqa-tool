using System.Runtime.Serialization;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleSurveyValue : IRule
{
    public string Id { get; }
    public Severity Severity { get; }

    private readonly string _ifcClass;
    private readonly string _pset;
    private readonly string _key;

    public RuleSurveyValue(
        string id,
        Severity severity,
        string ifcClass,
        string pset,
        string key
    )
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
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
            var ps = IfcPropertyUtils.GetAllPropertySets(p)
                .FirstOrDefault(x => x.Name?.ToString() == _pset);
            if (ps == null) continue;

            var prop = ps.HasProperties?.FirstOrDefault(hp => hp.Name.ToString() == _key);
            if (prop == null) continue;

            var val = IfcValueUtils.GetSingleValueAsString(prop);

            yield return new Issue(
                Id,
                Severity,
                _ifcClass,
                p.GlobalId,
                p.Name,
                $"Observed '{_pset}.{_key}' = '{val ?? "<null>"}'"
            );
        }
    }
}