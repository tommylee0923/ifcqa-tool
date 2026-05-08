using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using IfcQa.Core;

internal static class HtmlReportWriter
{
    private static JsonSerializerOptions JsonOpts() => new()
    {
        WriteIndented = false,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter() }
    };

    private static string LocateTemplateDir()
    {
        var baseDir = AppContext.BaseDirectory;
        var candidate = Path.Combine(baseDir, "Report", "Templates");
        if (Directory.Exists(candidate)) return candidate;

        candidate = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "Report", "Templates"));
        if (Directory.Exists(candidate)) return candidate;

        throw new DirectoryNotFoundException(
            $"ReportTemplates folder not found. Tried:\n- {Path.Combine(baseDir, "Report", "Templates")}\n- {candidate}");
    }

    public static string Build(IfcQaRunResult run, string rulesetName, string rulesetVersion, string? rulesetJsonText = null, bool includeViewer = false)
    {
        var issues = run.Issues ?? new List<Issue>();

        int errors = issues.Count(i => i.Severity == Severity.Error);
        int warnings = issues.Count(i => i.Severity == Severity.Warning);
        int info = issues.Count(i => i.Severity == Severity.Info);

        static int SevRank(Severity s) => s switch
        {
            Severity.Error => 0,
            Severity.Warning => 1,
            _ => 2
        };

        issues = issues
          .OrderBy(i => SevRank(i.Severity))
          .ThenBy(i => i.RuleId)
          .ThenBy(i => i.IfcClass)
          .ThenBy(i => i.Name)
          .ThenBy(i => i.GlobalId)
          .ToList();

        var rulesetMeta = BuildRulesetMeta(rulesetJsonText);

        var payload = new
        {
            ifcPath = run.IfcPath,
            ruleset = new { name = rulesetName, version = rulesetVersion },
            rulesetMeta,
            counts = new { total = issues.Count, errors, warnings, info },
            issues = issues.Select(i => new
            {
                ruleId = i.RuleId,
                severity = i.Severity.ToString(),
                ifcClass = i.IfcClass,
                globalId = i.GlobalId,
                name = i.Name ?? "",
                message = i.Message,
                path = i.Path ?? "",
                source = i.Source?.ToString() ?? "",
                expected = i.Expected ?? "",
                actual = i.Actual ?? ""
            }).ToList()
        };

        var json = JsonSerializer.Serialize(payload, JsonOpts());
        json = json.Replace("</script>", "<\\/script>", StringComparison.OrdinalIgnoreCase);

        var templateDir = LocateTemplateDir();

        var htmlTpl = File.ReadAllText(Path.Combine(templateDir, "report.template.html"));
        var css = File.ReadAllText(Path.Combine(templateDir, "report.css"));
        var js = File.ReadAllText(Path.Combine(templateDir, "report.js"));

        htmlTpl = htmlTpl.Replace("/* { { CSS } } */", css);
        htmlTpl = htmlTpl.Replace("// { { JS } }", js);
        htmlTpl = htmlTpl.Replace("{{DATA_JSON}}", json);

        return htmlTpl;
    }

    private static Dictionary<string, object> BuildRulesetMeta(string? rulesetJsonText)
    {
        var map = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(rulesetJsonText)) return map;

        using var doc = JsonDocument.Parse(rulesetJsonText);
        if (!doc.RootElement.TryGetProperty("rules", out var rules) || rules.ValueKind != JsonValueKind.Array)
            return map;

        foreach (var r in rules.EnumerateArray())
        {
            if (!r.TryGetProperty("id", out var idEl)) continue;
            var id = idEl.GetString();
            if (string.IsNullOrWhiteSpace(id)) continue;

            // meta is optional
            string title = "", why = "", howToFix = "", desc = "";
            List<string> refs = new();

            if (r.TryGetProperty("meta", out var meta) && meta.ValueKind == JsonValueKind.Object)
            {
                if (meta.TryGetProperty("title", out var x) && x.ValueKind == JsonValueKind.String) title = x.GetString() ?? "";
                if (meta.TryGetProperty("why", out x) && x.ValueKind == JsonValueKind.String) why = x.GetString() ?? "";
                if (meta.TryGetProperty("howToFix", out x) && x.ValueKind == JsonValueKind.String) howToFix = x.GetString() ?? "";
                if (meta.TryGetProperty("description", out x) && x.ValueKind == JsonValueKind.String) desc = x.GetString() ?? "";

                if (meta.TryGetProperty("references", out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var el in arr.EnumerateArray())
                        if (el.ValueKind == JsonValueKind.String) refs.Add(el.GetString() ?? "");
                }
            }

            // allow legacy top-level fields too
            if (string.IsNullOrWhiteSpace(desc) && r.TryGetProperty("description", out var d) && d.ValueKind == JsonValueKind.String)
                desc = d.GetString() ?? "";
            if (string.IsNullOrWhiteSpace(title) && r.TryGetProperty("title", out var t) && t.ValueKind == JsonValueKind.String)
                title = t.GetString() ?? "";

            map[id] = new { title, why, howToFix, description = desc, references = refs };
        }

        return map;
    }

}