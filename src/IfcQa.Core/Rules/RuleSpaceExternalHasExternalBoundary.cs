using IfcQa.Core.Rules;
using System;
using System.Collections.Generic;
using System.Linq;
using Xbim.Ifc;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core.Rules;

public sealed class RuleSpaceExternalHasExternalBoundary : IRule
{
    public string Id {get; set;}
    public Severity Severity {get; set;}

    public RuleSpaceExternalHasExternalBoundary(
        string id,
        Severity severity
    )
    {
        Id = id;
        Severity = severity;
    }

    public IEnumerable<Issue> Evaluate(IfcStore model)
    {
        var boundaries = model.Instances.OfType<IIfcRelSpaceBoundary>().ToList();
        var bySpace = boundaries
            .Where(b => b.RelatingSpace != null)
            .GroupBy(b => b.RelatingSpace);
        
        foreach (var g in bySpace)
        {
            var space = g.Key as IIfcSpace;
            if (space == null) continue;

            var spacePset = IfcPropertyUtils.GetAllPropertySets(space)
                .FirstOrDefault(ps => ps.Name?.ToString() == "Pset_SpaceCommon");
            
            var isExtProp = spacePset?.HasProperties
                .FirstOrDefault(hp => hp.Name.ToString() == "IsExternal");
            
            var IsExternal = isExtProp != null ? IfcValueUtils.GetSingleValueAsBool(isExtProp) : null;
            if (IsExternal != true) continue;

            bool hasExternalWallBoundary = g
                .Select(b => b.RelatedBuildingElement)
                .OfType<IIfcWall>()
                .Any(w =>
                {
                    var wallPset = IfcPropertyUtils.GetAllPropertySets(w)
                        .FirstOrDefault(ps => ps.Name?.ToString() == "Pset_WallCommon");
                    
                    var wIsExtProp = wallPset?.HasProperties
                        .FirstOrDefault(p => p.Name.ToString() == "IsExternal");
                    
                    return wIsExtProp != null && IfcValueUtils.GetSingleValueAsBool(wIsExtProp) == true;
                });
            
            if (!hasExternalWallBoundary)
            {
                yield return new Issue(
                    Id,
                    Severity,
                    space.ExpressType.Name,
                    space.GlobalId.ToString() ?? "",
                    space.Name?.ToString(),
                    "Space is marked IsExternal=TRUE but no bounding wall is marked IsExternal=TRUE."
                );
            }
        }
    }
}