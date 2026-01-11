using Microsoft.Isam.Esent.Interop;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Metadata.Ecma335;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleRequiredPsetPropertyValueNumber : IRule
{
    public string Id {get;}
    public Severity Severity {get;}

    private readonly string _ifcClass;
    private readonly string _psetName;
    private readonly string _propertyKey;
    private readonly double _minExclusive;

    public RuleRequiredPsetPropertyValueNumber(
        string id,
        Severity severity,
        string ifcClass,
        string psetName,
        string propertyKey,
        double minExclusive = 0.0)
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _psetName = psetName;
        _propertyKey = propertyKey;
        _minExclusive = minExclusive;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances.OfType<IIfcProduct>()
            .Where(p => p.ExpressType.Name.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase));

        foreach (var p in products)
        {
            var pset = IfcPropertyUtils.GetAllPropertySets(p)
                .FirstOrDefault(ps => ps.Name?.ToString() == _psetName);

            if (pset == null) continue;

            var prop = pset.HasProperties
                .FirstOrDefault(hp => hp.Name.ToString() == _propertyKey);
            if (prop == null) continue;

            var v = IfcValueUtils.GetSingleValueAsDouble(prop);
            if (v is null)
            {
                yield return new Issue(
                    Id,
                    Severity,
                    p.ExpressType.Name,
                    p.GlobalId.ToString() ?? "",
                    p.Name?.ToString(),
                    $"Property '{_propertyKey}' in '{_psetName}' is missing or not numeric."
                );
            }
            else if (v <= _minExclusive)
            {
                yield return new Issue(
                    Id,
                    Severity,
                    p.ExpressType.Name,
                    p.GlobalId.ToString() ?? "",
                    p.Name?.ToString(),
                    $"Property '{_propertyKey}' in '{_psetName}' must be > {_minExclusive} (found {v})."
                );
            }
        }
    }
}