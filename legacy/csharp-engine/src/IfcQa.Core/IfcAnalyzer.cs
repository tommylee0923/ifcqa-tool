using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xbim.Ifc;
using Xbim.Common;
using Xbim.Ifc4.Interfaces;
using IfcQa.Core.Rules;
using System.Xml.Schema;

namespace IfcQa.Core;

public sealed class IfcAnalyzer
{
    public IfcSummaryReport Analyze(string ifcPath)
    {
        if (string.IsNullOrWhiteSpace(ifcPath))
            throw new ArgumentNullException("IFC path is empty", nameof(ifcPath));

        if (!File.Exists(ifcPath))
            throw new FileNotFoundException("IFC file not found.", ifcPath);

        using var model = IfcStore.Open(ifcPath);

        var products = model.Instances.OfType<IIfcProduct>()
            .Where(p => p != null && p.ExpressType != null)
            .ToList();

        var byClass = products
            .GroupBy(p => p.ExpressType.Name)
            .Select(n => new IfcClassStats
            {
                IfcClass = n.Key,
                Count = n.Count(),
                WithAnyPsetCount = n.Count(p => IfcPropertyUtils.HasAnyPset(p)),
                WithAnyQtoCount = n.Count(p => IfcPropertyUtils.HasAnyQto(p))
            })
            .OrderByDescending(x => x.Count)
            .ToList();

        var allPsetNames = products
            .SelectMany(p => IfcPropertyUtils.GetPropertySets(p))
            .Select(ps => ps.Name?.ToString())
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .GroupBy(n => n!)
            .OrderByDescending(n => n.Count())
            .Select(n => new NameCount(n.Key, n.Count()))
            .ToList();

        var allQtoNames = products
            .SelectMany(p => IfcPropertyUtils.GetQuantitySets(p))
            .Select(n => n.Name?.ToString())
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .GroupBy(n => n!)
            .OrderByDescending(g => g.Count())
            .Select(n => new NameCount(n.Key, n.Count()))
            .ToList();

        return new IfcSummaryReport
        {
            IfcPath = ifcPath,
            ProductCount = products.Count,
            ByClass = byClass,
            TopPsets = allPsetNames.Take(30).ToList(),
            TopQtos = allQtoNames.Take(30).ToList(),
        };
    }

    public IfcQaRunResult AnalyzeWithRules(string ifcPath, IEnumerable<IRule> rules)
    {
        using var model = IfcStore.Open(ifcPath);

        var allIssues = new List<Issue>();

        foreach (var rule in rules)
        {
            var issues = rule.Evaluate(model);
            allIssues.AddRange(issues);
        }
        
        return new IfcQaRunResult(ifcPath, allIssues);
    }
    public sealed class IfcSummaryReport
    {
        public required string IfcPath { get; init; }
        public int ProductCount { get; init; }
        public List<IfcClassStats> ByClass { get; init; } = new();
        public List<NameCount> TopPsets { get; init; } = new();
        public List<NameCount> TopQtos { get; init; } = new();
    }

    public sealed class IfcClassStats
    {
        public required string IfcClass { get; init; }
        public int Count { get; init; }
        public int WithAnyPsetCount { get; init; }
        public int WithAnyQtoCount { get; init; }
        public double WithAnyPsetPct => Count == 0 ? 0 : (double)WithAnyPsetCount / Count;
        public double WithAnyQtoPct => Count == 0 ? 0 : (double)WithAnyQtoCount / Count;
    }

    public sealed record NameCount(string Name, int Count);
}