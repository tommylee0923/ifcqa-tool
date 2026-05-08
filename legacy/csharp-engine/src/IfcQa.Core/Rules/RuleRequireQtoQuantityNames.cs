using IfcQa.Core;
using IfcQa.Core.Rules;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleRequireQtoQuantityNames : IRule
{
    public string Id { get; }
    public Severity Severity { get; }

    private readonly string _ifcClass;
    private readonly string _qtoName;
    private readonly string[] _requiredQuanityNames;

    public RuleRequireQtoQuantityNames(
        string id,
        Severity severity,
        string ifcClass,
        string qtoName,
        params string[] requireQuantityNames)
    {
        Id = id;
        Severity = severity;
        _ifcClass = ifcClass;
        _qtoName = qtoName;
        _requiredQuanityNames = requireQuantityNames ?? Array.Empty<string>();
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var products = model.Instances.OfType<IIfcProduct>()
            .Where(p => p.ExpressType?.Name?.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);

        foreach (var p in products)
        {
            var qto = IfcPropertyUtils.GetAllQuantitySets(p)
                .FirstOrDefault(q => q.Name?.ToString() == _qtoName);

            if (_qtoName == null) continue;

            var available = new HashSet<string>(
                qto!.Quantities
                    .Select(q => q.Name.ToString())
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Select(n => n!),
                StringComparer.OrdinalIgnoreCase
            );

            foreach (var req in _requiredQuanityNames)
            {
                if (!available.Contains(req))
                {
                    yield return IssueTraceExtensions.Missing(
                        Id,
                        Severity,
                        p.ExpressType.Name,
                        p.GlobalId.ToString() ?? "",
                        p.Name?.ToString(),
                        path: $"Qto: {_qtoName}",
                        source: ValueSource.Derived,
                        $"Qto '{_qtoName}' is missing quantity '{req}."
                    );
                }
            }
        }
    }
}