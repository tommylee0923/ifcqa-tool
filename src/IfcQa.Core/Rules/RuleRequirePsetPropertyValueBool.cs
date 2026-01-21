using System;
using System.Collections.Generic;
using System.Linq;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules
{
    public sealed class RuleRequirePsetPropertyValueBool : IRule
    {
        public string Id { get; }
        public Severity Severity { get; }

        private readonly string _ifcClass;
        private readonly string _psetName;
        private readonly string _propertyKey;

        public RuleRequirePsetPropertyValueBool(string id, Severity severity, string ifcClass, string psetName, string propertyKey)
        {
            Id = id;
            Severity = severity;
            _ifcClass = ifcClass;
            _psetName = psetName;
            _propertyKey = propertyKey;
        }

        public IEnumerable<Issue> Evaluate(IfcStore model)
        {
            var products = model.Instances.OfType<IIfcProduct>()
                .Where(p => p.ExpressType?.Name?.Equals(_ifcClass, StringComparison.OrdinalIgnoreCase) == true);

            foreach (var p in products)
            {
                var pset = IfcPropertyUtils.GetAllPropertySets(p)
                    .FirstOrDefault(ps => ps.Name?.ToString() == _psetName);

                if (pset == null) continue;

                var prop = pset.HasProperties.FirstOrDefault(hp => hp.Name.ToString() == _propertyKey);
                if (prop == null) continue;

                var b = IfcValueUtils.GetSingleValueAsBool(prop);
                if (b is null)
                {
                    yield return new Issue(
                        Id,
                        Severity,
                        p.ExpressType.Name,
                        p.GlobalId.ToString() ?? "",
                        p.Name?.ToString(),
                        $"Property '{_propertyKey}' in '{_psetName}' is missing or not a boolean."
                    ).WithTrace(
                        path: $"{_psetName}.{_propertyKey}",
                        source: ValueSource.Derived,
                        expected: "Boolean",
                        actual: "Missing or invalid"
                    );
                }
            }
        }
    }
}
