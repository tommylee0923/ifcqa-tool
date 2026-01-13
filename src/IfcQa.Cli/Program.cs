using System.Text;
using System.Text.Json;
using IfcQa.Core;
using IfcQa.Core.Catalog;
using IfcQa.Core.Rules;


if (args.Length == 0)
{
    PrintUsage();
    return;
}

var cmd = args[0].ToLowerInvariant();

if (cmd != "check" && cmd != "catalog")
{
    Console.WriteLine($"Unknown command: {cmd}.");
    PrintUsage();
    return;
}

if (args.Length < 2)
{
    Console.WriteLine("Missing IFC file path.");
    PrintUsage();
    return;
}

var ifcPath = args.Length > 1 ? args[1] : throw new ArgumentException("Missing IFC File.");
var rulesetPath = GetOption(args, "--rules", Path.Combine("rulesets", "basic-ifcqa.json"));
var outDir = GetOption(args, "--out", "out");

rulesetPath = Path.GetFullPath(rulesetPath);
outDir = Path.GetFullPath(outDir);

Directory.CreateDirectory(outDir);

var issuesJsonPath = Path.Combine(outDir, "issues.json");
var issuesCsvPath = Path.Combine(outDir, "issues.csv");
var reportJsonPath = Path.Combine(outDir, "report.json");
var catalogJsonPath = Path.Combine(outDir, "catalog.json");

if (cmd == "catalog")
{
    var builder = new IfcCatalogBuilder();
    var catalog = builder.Build(ifcPath);

    var jsonC = JsonSerializer.Serialize(catalog, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(catalogJsonPath, jsonC);
    Console.WriteLine($"Wrote {catalogJsonPath}");
    Console.WriteLine($"Classes:        {catalog.ClassToPsets.Count} (Psets, {catalog.ClassToQtos.Count} (Qtos");
    Console.WriteLine($"Unique Psets:   {catalog.PsetToPropertyKeys.Count}");
    Console.WriteLine($"Unique Qtos:    {catalog.QtoToQuantityNames.Count}");
    return;
}

if (cmd == "check")
{
    var (specs, rules) = RulesetLoader.Load(rulesetPath);

    Console.WriteLine($"Loaded ruleset {specs.Name} ({specs.Version}), rules: {rules.Length}");

    var analyzer = new IfcAnalyzer();
    var run = analyzer.AnalyzeWithRules(ifcPath, rules);
    var byRule = run.Issues
        .GroupBy(i => i.RuleId)
        .Select(g => new
        {
            RuleId = g.Key,
            Total = g.Count(),
            Errors = g.Count(x => x.Severity == Severity.Error),
            Warnings = g.Count(x => x.Severity == Severity.Warning),
            Info = g.Count(x => x.Severity == Severity.Info),
        })
        .OrderByDescending(x => x.Total)
        .ToList();

    var uniqueElementsAffected = run.Issues
        .Select(i => i.GlobalId)
        .Where(gid => !string.IsNullOrWhiteSpace(gid))
        .Distinct()
        .Count();

    var report = new
    {
        IfcPath = ifcPath,
        Ruleset = new { specs.Name, specs.Version, RulesetPth = rulesetPath },
        OutputDir = outDir,
        Counts = new
        {
            Total = run.Issues.Count,
            Errors = run.Issues.Count(i => i.Severity == Severity.Error),
            Warnings = run.Issues.Count(i => i.Severity == Severity.Warning),
            Info = run.Issues.Count(i => i.Severity == Severity.Info),
        },
        UniqueElementsAffected = uniqueElementsAffected,
        ByRule = byRule
    };

    var json = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true });

    File.WriteAllText(reportJsonPath, json);
    Console.WriteLine("Wrote report.json.");


    var issueJson = JsonSerializer.Serialize(run, new JsonSerializerOptions { WriteIndented = true });
    File.WriteAllText(issuesJsonPath, issueJson);
    Console.WriteLine("Wrote issues.json.");

    File.WriteAllText(issuesCsvPath, BuildIssuesCsv(run.Issues));
    Console.WriteLine("Wrote issues.csv");

    Console.WriteLine();
    Console.WriteLine("Summary:");
    Console.WriteLine($" Total: {report.Counts.Total}   ErrorsL {report.Counts.Errors}  Warnings: {report.Counts.Warnings}  Info: {report.Counts.Info}");
    Console.WriteLine($" Unique elements affected: {uniqueElementsAffected}");

    if (byRule.Count > 0)
    {
        Console.WriteLine(" By rule:");
        foreach (var r in byRule)
        {
            Console.WriteLine($"    {r.RuleId}: {r.Total}: (E:{r.Errors} W:{r.Warnings} I:{r.Info})");
        }
    }
}

static void PrintUsage()
{
    Console.WriteLine("Usage:");
    Console.WriteLine(" IfcQa.Cli catalog   <path-to-ifc> [--out <dir>]");
    Console.WriteLine(" IfcQa.Cli check     <path-to-ifc> [--rules <ruleset.json>]");
}

static string GetOption(string[] args, string name, string defaultValue)
{
    var idx = Array.FindIndex(args, a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase));
    if (idx < 0) return defaultValue;
    if (idx + 1 >= args.Length) throw new ArgumentException($"Missing value after {name}");
    return args[idx + 1];
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


