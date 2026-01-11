using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xbim.Ifc;
using Xbim.Common;
using Xbim.Ifc4.Interfaces;
using IfcQa.Core.Rules;
using Ifc.Qa.Rules;
using System.Xml.Schema;

namespace IfcQa.Core;

public sealed class IfcAnalyzer
{
    public IfcSummaryReport Analyze(string ifcPath)
    {
        if (string.IsNullOrWhiteSpace(ifcPath))
        {
            throw new ArgumentNullException("IFC path is empty", nameof(ifcPath));
        }
        if (!File.Exists(ifcPath))
        {
            throw new FileNotFoundException("IFC file not found.", ifcPath);
        }

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

    public IfcQaRunResult AnalyzeWithRules(string ifcPath)
    {
        using var model = IfcStore.Open(ifcPath);

        IRule[] rules =
            [
                new RuleMissingName(),
                new RuleMissingContainment(),
                new RuleDuplicateGlobalId(),

                //Walls
                new RuleRequirePset("W101", Severity.Error, "IfcWall", "Pset_WallCommon"),
                new RuleRequireQto("W102", Severity.Warning, "IfcWall", "Qto_WallBaseQuantities"),
                new RuleRequirePset("W101", Severity.Error, "IfcWallStandardCase", "Pset_WallCommon"),
                new RuleRequireQto("W102", Severity.Warning, "IfcWallStandardCase", "Qto_WallBaseQuantities"),
                new RuleRequirePsetPropertyKeys("W201", Severity.Error,   "IfcWall", "Pset_WallCommon", "IsExternal"),
                new RuleRequirePsetPropertyKeys("W202", Severity.Warning, "IfcWall", "Pset_WallCommon", "LoadBearing"),
                new RuleRequirePsetPropertyValueBool("W301", Severity.Error, "IfcWall", "Pset_WallCommon", "IsExternal"),
                new RuleRequirePsetPropertyValueBool("W302", Severity.Warning, "IfcWall", "Pset_WallCommon", "LoadBearing"),
                new RuleRequirePsetPropertyValueBool("W301", Severity.Error, "IfcWallStandcardCase", "Pset_WallCommon", "IsExternal"),
                new RuleRequirePsetPropertyValueBool("W302", Severity.Warning, "IfcWallStandcardCase", "Pset_WallCommon", "LoadBearing"),
                new RuleRequireQtoQuantityNames("W401", Severity.Warning, "IfcWall", "Qto_WallBaseQuantities", "Length", "NetSideArea"),
                new RuleRequireQtoQuantityValueNumber("W501", Severity.Warning, "IfcWall", "Qto_WallBaseQuantities", "Length", 0),
                new RuleRequireQtoQuantityValueNumber("W502", Severity.Warning, "IfcWall", "Qto_WallBaseQuantities", "NetSideArea", 0),

                //Slabs
                new RuleRequirePset("S101", Severity.Error, "IfcSlab", "Pset_SlabCommon"),
                new RuleRequireQto("S102", Severity.Warning, "IfcSlab", "Qto_SlabBaseQuantities"),
                new RuleRequirePsetPropertyValueBool("S301", Severity.Warning, "IfcSlab", "Pset_SlabCommon", "IsExternal"),
                new RuleRequireQtoQuantityNames("S401", Severity.Warning, "IfcSlab", "Qto_SlabBaseQuantities", "NetArea"),
                new RuleRequireQtoQuantityValueNumber("S501", Severity.Warning, "IfcSlab", "Qto_SlabBaseQuantities", "NetArea", 0),

                //Roof
                new RuleRequirePset("R101", Severity.Warning, "IfcRoof", "Pset_RoofCommon"),
                //new RuleRequireQto("R102", Severity.Warning, "IfcRoof", "Qto_RoofBaseQuantities"),

                //Spaces
                new RuleRequirePset("SP101", Severity.Warning, "IfcSpace", "Pset_SpaceCommon"),
                new RuleRequirePsetPropertyKeys("SP201", Severity.Warning, "IfcSpace", "Pset_SpaceCommon", "NetPlannedArea"),
                new RuleRequiredPsetPropertyValueNumber("SP301", Severity.Warning, "IfcSpace", "Pset_SpaceCommon", "NetPlannedArea", 0),
                new RuleRequiredPsetPropertyValueNumber("SP302", Severity.Warning, "IfcSpace", "Pset_SpaceCommon", "GrossPlannedArea", 0),
                new RuleComparePsetNumbers("SP303", Severity.Warning, "IfcSpace", "Pset_SpaceCommon", "GrossPlannedArea", "NetPlannedArea"),

                //Building
                new RuleRequirePset("B101", Severity.Info, "IfcBuilding", "Pset_BuildingCommon"),
            ];

        var issues = rules.SelectMany(r => r.Evaluate(model)).ToList();

        return new IfcQaRunResult(ifcPath, issues);
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