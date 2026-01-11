using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules
{
    public sealed class RuleRequireQto : IRule
    {
        public string Id { get; }
        public Severity Severity { get; }
        private readonly string _ifcClass;
        private readonly string _qtoName;

        public RuleRequireQto(string id, Severity severity, string ifcClass, string qtoName)
        {
            Id = id;
            Severity = severity;
            _ifcClass = ifcClass;
            _qtoName = qtoName;
        }

        public IEnumerable<Issue> Evaluate(IfcStore model)
        {
            var products = model.Instances.OfType<IIfcProduct>()
                .Where(p => p.ExpressType.Name.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase));


            foreach (var p in products)
            {
                if (!IfcPropertyUtils.HasQto(p, _qtoName))
                {
                    yield return new Issue(
                        Id,
                        Severity,
                        p.ExpressType.Name,
                        p.GlobalId.ToString() ?? "",
                        p.Name?.ToString(),
                        $"Missing required quantity set (recommended): {_qtoName}"
                        );
                }
            }
        }
    }
}
