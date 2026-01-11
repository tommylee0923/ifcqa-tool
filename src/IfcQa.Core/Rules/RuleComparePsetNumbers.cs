using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Reflection.Metadata.Ecma335;
using Xbim.Common;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleComparePsetNumbers : IRule
{
    public string Id {get;}
    public Severity Severity {get;}

    private readonly string _ifcClass;
    private readonly string _psetName;
    private readonly string _aKey;
    private readonly string _bKey;

    public RuleComparePsetNumbers(
        string id, Severity severity, string ifcClass, string psetName, string aKey, string bKey)
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _psetName = psetName;
        _aKey = aKey;
        _bKey = bKey;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances.OfType<IIfcProduct>()
            .Where(p => p.ExpressType.Name.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase));

        
        foreach (var p in products)
        {
            var pset = IfcPropertyUtils.GetAllPropertySets(p)
                .FirstOrDefault(ps => ps.Name?.ToString() == _psetName);
            if(pset == null) continue;

            var aProp = pset.HasProperties.FirstOrDefault(hp => hp.Name.ToString() == _aKey);
            var bProp = pset.HasProperties.FirstOrDefault(hp => hp.Name.ToString() == _bKey);
            if (aProp is null || bProp is null) continue;

            var a = IfcValueUtils.GetSingleValueAsDouble(aProp);
            var b = IfcValueUtils.GetSingleValueAsDouble(bProp);
            if (a is null || b is null) continue;

            if (a < b)
            {
                yield return new Issue(
                    Id, 
                    Severity, 
                    p.ExpressType.Name, 
                    p.GlobalId.ToString() ?? "", 
                    p.Name?.ToString(),
                    $"'{_aKey}' ({a}) should be >= '{_bKey}' ({b}) in '{_psetName}'."
                );
            }
        }
    }
}