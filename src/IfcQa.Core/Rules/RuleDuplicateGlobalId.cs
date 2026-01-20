using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules
{
    public sealed class RuleDuplicateGlobalId : IRule
    {
        public string Id {get;}
        public Severity Severity {get;}

        public RuleDuplicateGlobalId(string id, Severity severity)
        {
            Id = id;
            Severity = severity; 
        }

        public IEnumerable<Issue> Evaluate(IfcStore model)
        {
            var products = model.Instances.OfType<IIfcProduct>()
                .Where(p => !string.IsNullOrWhiteSpace(p.GlobalId.ToString()))
                .ToList();

            var dupGroups = products
                .GroupBy(p => p.GlobalId!.ToString())
                .Where(g => g.Count() > 1);

            foreach (var g in dupGroups)
                foreach (var p in g)
                {
                    yield return new Issue(
                        Id,
                        Severity,
                        p.ExpressType.Name,
                        p.GlobalId.ToString(),
                        p.Name?.ToString(),
                        $"Duplicate GlobalId"
                        )
                        .WithTrace(
                            path: "Attribute: GlobalId",
                            source: ValueSource.Attribute,
                            expected: "Unique",
                            actual: $"Duplicate: {g.Key} (count = {g.Count()}.)."
                        );
                }
        }
    }
}
