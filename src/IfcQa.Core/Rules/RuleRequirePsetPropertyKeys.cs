using System;
using System.Collections.Generic;
using System.Linq;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules
{
    public sealed class RuleRequirePsetPropertyKey : IRule
    {
        public string Id { get; }
        public Severity Severity { get; }

        private readonly string _ifcClass;
        private readonly string _psetName;
        private readonly string _propertyKey;

        public RuleRequirePsetPropertyKey(string id, Severity severity, string ifcClass, string psetName, string propertyKey)
        {
            Id = id;
            Severity = severity;
            _ifcClass = ifcClass;
            _psetName = psetName;
            _propertyKey = propertyKey;
        }

        public IEnumerable<Issue> Evaluate(IfcStore model)
        {
            var products = model.Instances
                .OfType<IIfcProduct>()
                .Where(p => p.ExpressType.Name.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase));

            foreach (var p in products)
            {
                var pset = IfcPropertyUtils.GetAllPropertySets(p)
                    .FirstOrDefault(ps => ps.Name?.ToString() == _psetName);

                if (pset == null) continue;

                bool hasKey = pset.HasProperties
                    .Any(prop => prop.Name.ToString() == _propertyKey);

                if (!hasKey)
                {
                    yield return new Issue(
                        Id,
                        Severity,
                        p.ExpressType.Name,
                        p.GlobalId.ToString() ?? "",
                        p.Name?.ToString(),
                        $"Pset {_psetName} is missing property key '{_propertyKey}'."
                    );
                }
            }
        }
    }
}
