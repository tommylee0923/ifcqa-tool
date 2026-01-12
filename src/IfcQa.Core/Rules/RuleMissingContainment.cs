using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules
{
    public sealed class RuleMissingContainment : IRule
    {
        
        public string Id {get;}
        public Severity Severity {get;}
        public RuleMissingContainment(string id, Severity severity)
        {
            Id = id;
            Severity = severity;
        }

        public IEnumerable<Issue> Evaluate(IfcStore model)
        {
            var elements = model.Instances.OfType<IIfcElement>();

            foreach (var e in elements)
            {
                if (e is IIfcSpatialElement) continue;

                bool hasContainment = e.ContainedInStructure != null && e.ContainedInStructure.Any();
                if (!hasContainment)
                {
                    yield return new Issue(
                        Id,
                        Severity,
                        e.ExpressType.Name,
                        e.GlobalId.ToString() ?? "",
                        e.Name?.ToString(),
                        "Element is not contained in a spatial structure (storey/building)."
                        );
                }
            }
        }
    }
}
