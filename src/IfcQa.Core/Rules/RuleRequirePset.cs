using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules
{
    public sealed class RuleRequirePset : IRule
    {
        public string Id { get; }
        public Severity Severity { get; }
        private readonly string _ifcClass;
        private readonly string _psetName;

        public RuleRequirePset(string id, Severity severity, string ifcClass, string psetName)
        {
            Id = id;
            Severity = severity;
            _ifcClass = ifcClass;
            _psetName = psetName;
        }

        public IEnumerable<Issue> Evaluate(IfcStore model)
        {
            var products = model.Instances.OfType<IIfcProduct>()
                .Where(p => p.ExpressType?.Name?.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);


            foreach (var p in products)
            {
                if (!IfcPropertyUtils.HasPset(p, _psetName))
                {
                    yield return IssueTraceExtensions.Missing(
                        Id,
                        Severity,
                        _ifcClass,
                        p.GlobalId.ToString() ?? "",
                        p.Name?.ToString(),
                        path: $"Pset: {_psetName}",
                        source: ValueSource.Derived,
                        message: $"Missing required property set."
                        );
                }
            }
        }
    }
}
