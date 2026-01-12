using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules
{
    public sealed class RuleMissingName : IRule
    {
        public string Id {get;}
        public Severity Severity {get; }

        public RuleMissingName(string id, Severity severity)
        {
            Id = id;
            Severity = severity;
        }

        public IEnumerable<Issue> Evaluate(IfcStore model)
        {
            var products = model.Instances.OfType<IIfcProduct>();

            foreach (var p in products)
            {
                var name = p.Name?.ToString();
                if (string.IsNullOrWhiteSpace(name))
                {
                    yield return new Issue(
                        Id,
                        Severity,
                        p.ExpressType.Name,
                        p.GlobalId.ToString() ?? "",
                        name,
                        "Element Name is missing/blank."
                        );
                }
            }
        }
    }
}
