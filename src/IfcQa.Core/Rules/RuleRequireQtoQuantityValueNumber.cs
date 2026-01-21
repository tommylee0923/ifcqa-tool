using System;
using System.Collections.Generic;
using System.Diagnostics.Tracing;
using System.Linq;
using System.Net;
using System.Net.Quic;
using System.Xml.Schema;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleRequireQtoQuantityValueNumber : IRule
{
    public string Id { get; }
    public Severity Severity { get; }

    private readonly string _ifcClass;
    private readonly string _qtoName;
    private readonly string _quantityName;
    private readonly double _minExclusive;

    public RuleRequireQtoQuantityValueNumber(
        string id,
        Severity severity,
        string ifcClass,
        string qtoName,
        string quantityName,
        double minExclusive)
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _qtoName = qtoName;
        _quantityName = quantityName;
        _minExclusive = minExclusive;
    }

    static bool Eq(string? a, string b) => string.Equals(a?.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);
    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances.OfType<IIfcProduct>()
            .Where(p => p.ExpressType.Name.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase));

        foreach (var p in products)
        {
            var qto = IfcPropertyUtils.GetAllQuantitySets(p)
                .FirstOrDefault(q => Eq(q.Name.ToString(), _qtoName));
            if (qto == null)
            {
                continue;
            }

            var qty = qto.Quantities
                .FirstOrDefault(qty => Eq(qty.Name.ToString(), _quantityName));
            if (qty == null)
            {
                continue;
            }

            var v = IfcQuantityUtils.GetQuantityValue(qty);
            if (v is null || double.IsNaN(v.Value) || double.IsInfinity(v.Value))
            {
                yield return new Issue(
                    Id,
                    Severity,
                    p.ExpressType.Name,
                    p.GlobalId.ToString() ?? "",
                    p.Name?.ToString(),
                    $"Quantity '{_quantityName}' in '{_qtoName}' is missing or not numeric."
                ).WithTrace(
                    path: $"Qto: {_qtoName}.{_quantityName}",
                    source: ValueSource.Derived,
                    expected: "Numeric",
                    actual: "Missing or invalid"
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
                    $"Quantity '{_quantityName}' in '{_qtoName}' must be > {_minExclusive} (found {v})."
                ).WithTrace(
                    path: $"{_qtoName}.{_quantityName}",
                    source: ValueSource.Derived,
                    expected: $"> {_minExclusive}",
                    actual: v.ToString()
                );
            }
        }
    }
}