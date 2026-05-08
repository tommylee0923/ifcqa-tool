using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleWallVolumeImpliesLength : IRule
{
    public string Id {get;}
    public Severity Severity {get;}

    public RuleWallVolumeImpliesLength(
        string id,
        Severity severity
    )
    {
        Id = id;
        Severity = severity;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var walls = model.Instances.OfType<IIfcWall>();

        foreach (var w in walls)
        {
            var qto = IfcPropertyUtils.GetAllQuantitySets(w)
                .FirstOrDefault(q => q.Name?.ToString() == "Qto_WallBaseQuantities");
            if (qto == null) continue;

            double? netVol = Get(qto, "NetVolume");
            if (netVol == null || netVol <= 0) continue;

            double? len = Get(qto, "Length");
            if (len == null || len <= 0)
            {
                yield return new Issue(
                    Id,
                    Severity,
                    w.ExpressType.Name,
                    w.GlobalId.ToString() ?? "",
                    w.Name?.ToString(),
                    "Wall has NetVolume > 0 but Length is missing or <= 0"
                ).WithTrace(
                    path: $"{qto}: NetVolume > 0 implies Length > 0",
                    source: ValueSource.Derived,
                    expected: $"Length > 0 (when NetVolume > 0)",
                    actual: $"NetVolume = {netVol}, Length = {(len is null ? "Missing" : len.ToString())}"
                );
            }
        }
    }

    private static double? Get(IIfcElementQuantity qto, string qtyName)
    {
        var qty = qto.Quantities.FirstOrDefault(x =>
            string.Equals(x.Name.ToString()?.Trim(), qtyName, StringComparison.OrdinalIgnoreCase));
        
        return qty == null ? null : IfcQuantityUtils.GetQuantityValue(qty);
    }
}