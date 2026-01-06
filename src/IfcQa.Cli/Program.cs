using System.Text;
using System.Text.Json;
using IfcQa.Core;
using IfcQa.Core.Catalog;

//var ifcPath = args.Length > 0 ? args[0] : @"C:\Users\Tommy Lee\Documents\Project\IfcQaTool\samples\Building-Architecture.ifc";

var cmd = (args.Length > 0? args[0].ToLowerInvariant() : "");

if (args.Length == 0)
{
    if (cmd != "check" && cmd != "catalog") Console.WriteLine($"Unknown command: {cmd}");
    Console.WriteLine("Usage:");
    Console.WriteLine(" IfcQa.Cli   catalog   <path-to-ifc>");
    Console.WriteLine(" IfcQa.Cli   check     <path-to-ifc>");
    return;
}

var ifcPath = args.Length > 1 ? args[1] : throw new ArgumentException("Missing IFC File.");


if (cmd == "catalog")
{
    var builder = new IfcCatalogBuilder();
    var catalog = builder.Build(ifcPath);

    var jsonC = JsonSerializer.Serialize(catalog, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText("catalog.json", jsonC);
    Console.WriteLine("Wrote catalog.json");

    Console.WriteLine($"Classes:        {catalog.ClassToPsets.Count} (Psets, {catalog.ClassToQtos.Count} (Qtos");
    Console.WriteLine($"Unique Psets:   {catalog.PsetToPropertyKeys.Count}");
    Console.WriteLine($"Unique Qtos:    {catalog.QtoToQuantityNames.Count}");
    return;
}

if (cmd == "check")
{
    var analyzer = new IfcAnalyzer();
    var run = analyzer.AnalyzeWithRules(ifcPath);

    var report = analyzer.Analyze(ifcPath);

    var json = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true });
    Console.WriteLine(json);

    File.WriteAllText("report.json", json);
    Console.WriteLine("\nWrote report.json.");


    var issueJson = JsonSerializer.Serialize(run, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText("issues.json", json);
    Console.WriteLine("\nWrote issues.json.");

    File.WriteAllText("issue.csv", BuildIssuesCsv(run.Issues));
    Console.WriteLine("Wrote issues.csv");
}

static string BuildIssuesCsv(List<Issue> issues)
{
    static string Esc(string? s)
    {
        s ??= "";
        return $"\"{s.Replace("\"", "\"\"")}\"";
    }

    var sb = new StringBuilder();
    sb.AppendLine("RuleId,Severity,IfcClass,GlobalId,Name,Message");

    foreach (var i in issues)
    {
        sb.AppendLine(string.Join(",",
            Esc(i.RuleId),
            Esc(i.Severity.ToString()),
            Esc(i.IfcClass),
            Esc(i.GlobalId),
            Esc(i.Name),
            Esc(i.Message)
            ));
    }

    return sb.ToString();
}

