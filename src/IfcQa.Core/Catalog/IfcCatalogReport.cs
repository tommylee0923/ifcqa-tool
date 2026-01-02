using System.Collections.Generic;

namespace IfcQa.Core.Catalog
{
    public sealed class IfcCatalogReport
    {
        public required string IfcPath { get; set; }

        public Dictionary<string, Dictionary<string, int>> ClassToPsets { get; set; } = new();
        public Dictionary<string, Dictionary<string, int>> ClassToQtos { get; set; } = new();

        public Dictionary<string, HashSet<string>> PsetToPropertyKeys { get; set; } = new();

        public Dictionary<string, HashSet<string>> QtoToQuantityNames { get; set; } = new();
    }
}
