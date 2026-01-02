using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Catalog
{
    public sealed class IfcCatalogBuilder
    {
        public IfcCatalogReport Build(string ifcPath)
        {
            using var model = IfcStore.Open(ifcPath);

            var report = new IfcCatalogReport { IfcPath = ifcPath };

            var products = model.Instances.OfType<IIfcProduct>().ToList();

            foreach (var p in products)
            {
                var ifcClass = p.ExpressType.Name;

                var defs = IfcPropertyUtils.GetPropertySetDefinition(p);

                var pset = defs.OfType<IIfcPropertySet>().ToList();
                var qto = defs.OfType<IIfcElementQuantity>().ToList();

                foreach (var ps in pset)
                {
                    var name = ps.Name?.ToString();
                    if (string.IsNullOrWhiteSpace(name)) continue;

                    Increment(report.ClassToPsets, ifcClass, name!);

                    var keys = ps.HasProperties
                        .Select(prop => prop.Name.ToString())
                        .Where(k => !string.IsNullOrWhiteSpace(k))
                        .Select(k => k!);

                    AddMany(report.PsetToPropertyKeys, name!, keys);
                }
            }

            return report;
        }

        private static void Increment(Dictionary<string, Dictionary<string, int>> map, string outKey, string innerKey)
        {
            if (!map.TryGetValue(outKey, out var inner))
            {
                inner = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                map[outKey] = inner;
            }

            inner[innerKey] = inner.TryGetValue(innerKey, out var v) ? v + 1 : 1;
        }

        private static void AddMany(Dictionary<string, HashSet<string>> map, string key, IEnumerable<string> items)
        {
            if (!map.TryGetValue(key, out var set))
            {
                set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                map[key] = set;
            }

            foreach (var i in items)
            {
                set.Add(i);
            }
        }
    }
}
