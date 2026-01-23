using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using IfcQa.Core;
using IfcQa.Core.Catalog;
using IfcQa.Core.Rules;
using IfcQa.Core.Rules.Specs;


if (args.Length == 0)
{
    PrintUsage();
    return;
}

var cmd = args[0].ToLowerInvariant();

if (cmd != "check" && cmd != "catalog" && cmd != "init")
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


var outDir = GetOption(args, new[] { "--out", "-o" }, "out");
outDir = Path.GetFullPath(outDir);
Directory.CreateDirectory(outDir);
Directory.CreateDirectory(Path.Combine(outDir, "out"));

var reportHtmlPath = Path.Combine(outDir, "report.html");

var issuesJsonPath = Path.Combine(outDir, "issues.json");
var issuesCsvPath = Path.Combine(outDir, "issues.csv");
var reportJsonPath = Path.Combine(outDir, "report.json");
var catalogJsonPath = Path.Combine(outDir, "catalog.json");

if (cmd == "init")
{
    var baseDir = AppContext.BaseDirectory;

    var srcRulesets = Path.Combine(baseDir, "rulesets");
    var srcTemplates = Path.Combine(baseDir, "ReportTemplates");

    if (Directory.Exists(srcRulesets))
        CopyDir(Path.Combine(baseDir, "rulesets"), Path.Combine(outDir, "rulesets"));
    if (Directory.Exists(srcTemplates))
        CopyDir(Path.Combine(baseDir, "ReportTemplates"), Path.Combine(outDir, "ReportTemplates"));

    Console.WriteLine($"Initialized IfcQa project at: {outDir}");
    return;
}

if (cmd == "catalog")
{
    var builder = new IfcCatalogBuilder();
    var catalog = builder.Build(ifcPath);

    var jsonC = JsonSerializer.Serialize(catalog, JsonOpts());
    File.WriteAllText(catalogJsonPath, jsonC);
    Console.WriteLine($"Wrote {catalogJsonPath}");
    Console.WriteLine($"Classes:        {catalog.ClassToPsets.Count} (Psets), {catalog.ClassToQtos.Count} (Qtos)");
    Console.WriteLine($"Unique Psets:   {catalog.PsetToPropertyKeys.Count}");
    Console.WriteLine($"Unique Qtos:    {catalog.QtoToQuantityNames.Count}");
    return;
}

if (cmd == "check")
{
    try
    {
        var failOn = GetOption(args, new[] { "--fail-on" }, "Error");
        var threshold = ParseFailOn(failOn);

        var rulesetPath = GetOption(args, new[] { "--rules", "-r" }, Path.Combine("rulesets", "tool-agnostic-common.json"));
        rulesetPath = Path.GetFullPath(rulesetPath);

        var (specs, rules) = RulesetLoader.Load(rulesetPath);
        var rulesetJsonText = File.ReadAllText(rulesetPath);

        Console.WriteLine($"Loaded ruleset {specs.Name} ({specs.Version}), rules: {rules.Length}");

        var analyzer = new IfcAnalyzer();
        var run = analyzer.AnalyzeWithRules(ifcPath, rules);

        var html = HtmlReportWriter.Build(run, specs.Name, specs.Version, rulesetJsonText);
        File.WriteAllText(reportHtmlPath, html);
        Console.WriteLine("Wrote report.html");

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

        bool shouldFail = threshold switch
        {
            null => false,
            Severity.Error => run.Issues.Any(i => i.Severity == Severity.Error),
            Severity.Warning => run.Issues.Any(i => i.Severity == Severity.Error || i.Severity == Severity.Warning),
            Severity.Info => run.Issues.Any(i => i.Severity == Severity.Error || i.Severity == Severity.Warning || i.Severity == Severity.Info),
            _ => false
        };

        Environment.ExitCode = shouldFail ? 1 : 0;

        var json = JsonSerializer.Serialize(report, JsonOpts());

        File.WriteAllText(reportJsonPath, json);
        Console.WriteLine($"Wrote report.json. ({reportJsonPath})");


        var issueJson = JsonSerializer.Serialize(run, JsonOpts());
        File.WriteAllText(issuesJsonPath, issueJson);
        Console.WriteLine($"Wrote issues.json. ({issuesJsonPath})");

        File.WriteAllText(issuesCsvPath, BuildIssuesCsv(run.Issues));
        Console.WriteLine($"Wrote issues.csv ({issuesCsvPath})");

        Console.WriteLine();
        Console.WriteLine("Summary:");
        Console.WriteLine($" Total: {report.Counts.Total}   Errors: {report.Counts.Errors}  Warnings: {report.Counts.Warnings}  Info: {report.Counts.Info}");
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
    catch (RulesetValidationException ex)
    {
        Console.WriteLine($"Ruleset error: {ex.Message}");
        Environment.ExitCode = 2;
        return;
    }
}

static void PrintUsage()
{
    Console.WriteLine("Usage:");
    Console.WriteLine(" ifcqa init      [--out <dir> | -o <dir>]");
    Console.WriteLine(" ifcqa catalog   <path-to-ifc> [--out <dir> | -o <dir>]");
    Console.WriteLine(" ifcqa check     <path-to-ifc> [--rules <ruleset.json>] [--out <dir> | -o <dir>] [--fail-on Error|Warning|Info|None]");
}

static JsonSerializerOptions JsonOpts() => new()
{
    WriteIndented = true,
    Converters = { new JsonStringEnumConverter() }
};

static string GetOption(string[] args, string[] names, string defaultValue)
{
    var idx = Array.FindIndex(args, a => names.Any(n => string.Equals(a, n, StringComparison.OrdinalIgnoreCase)));
    if (idx < 0) return defaultValue;
    if (idx + 1 >= args.Length) throw new ArgumentException($"Missing value after {args[idx]}");
    return args[idx + 1];
}

static void CopyDir(string srcDir, string dstDir)
{
    if (!Directory.Exists(srcDir))
        throw new DirectoryNotFoundException(srcDir);
    
    Directory.CreateDirectory(dstDir);

    foreach (var file in Directory.GetFiles(srcDir, "*", SearchOption.AllDirectories))
    {
        var rel = Path.GetRelativePath(srcDir, file);
        var dest = Path.Combine(dstDir, rel);
        Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
        File.Copy(file, dest, overwrite: true);
    }
}

static Severity? ParseFailOn(string s)
{
    if (String.Equals(s, "none", StringComparison.OrdinalIgnoreCase)) return null;
    if (Enum.TryParse<Severity>(s, ignoreCase: true, out var sev)) return sev;
    throw new ArgumentException($"Invalid --fail-on value: {s}. Use Error|Warning|Info|None.");
}

static string BuildIssuesCsv(List<Issue> issues)
{
    static string Esc(string? s)
    {
        s ??= "";
        return $"\"{s.Replace("\"", "\"\"")}\"";
    }

    var sb = new StringBuilder();
    sb.AppendLine("RuleId,Severity,IfcClass,GlobalId,Name,Path,Source,Expected,Actual,Message");

    foreach (var i in issues)
    {
        sb.AppendLine(string.Join(",",
            Esc(i.RuleId),
            Esc(i.Severity.ToString()),
            Esc(i.IfcClass),
            Esc(i.GlobalId),
            Esc(i.Name),
            Esc(i.Path),
            Esc(i.Source.ToString()),
            Esc(i.Expected),
            Esc(i.Actual),
            Esc(i.Message)
            ));
    }

    return sb.ToString();
}


