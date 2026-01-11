using System;
using System.Collections.Generic;
using System.Linq;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core
{
    public static class IfcPropertyUtils
    {
        public static IEnumerable<IIfcPropertySet> GetAllPropertySets(IIfcProduct p)
        {
            var inst = p.IsDefinedBy
                .OfType<IIfcRelDefinesByProperties>()
                .Select(r => r.RelatingPropertyDefinition)
                .OfType<IIfcPropertySet>();

            var typeDefs = Enumerable.Empty<IIfcPropertySet>();
            if (p is IIfcObject obj)
            {
                typeDefs = obj.IsTypedBy
                    .OfType<IIfcRelDefinesByType>()
                    .Select(r => r.RelatingType)
                    .OfType<IIfcTypeObject>()
                    .SelectMany(t => t.HasPropertySets)
                    .OfType<IIfcPropertySet>();
            }

            return inst.Concat(typeDefs);
        }

        public static IEnumerable<IIfcElementQuantity> GetAllQuantitySets(IIfcProduct p)
        {
            var inst = p.IsDefinedBy
                .OfType<IIfcRelDefinesByProperties>()
                .Select(r => r.RelatingPropertyDefinition)
                .OfType<IIfcElementQuantity>();

            var typeDefs = Enumerable.Empty<IIfcElementQuantity>();
            if (p is IIfcObject obj)
            {
                typeDefs = obj.IsTypedBy
                    .OfType<IIfcRelDefinesByType>()
                    .Select(r => r.RelatingType)
                    .OfType<IIfcTypeObject>()
                    .SelectMany(t => t.HasPropertySets)
                    .OfType<IIfcElementQuantity>();
            }

            return inst.Concat(typeDefs);
        }

        public static IEnumerable<IIfcPropertySet> GetPropertySets(IIfcProduct p) =>
            p.IsDefinedBy
            .OfType<IIfcRelDefinesByProperties>()
            .Select(r => r.RelatingPropertyDefinition)
            .OfType<IIfcPropertySet>();

        public static IEnumerable<IIfcElementQuantity> GetQuantitySets(IIfcProduct p) =>
            p.IsDefinedBy
            .OfType<IIfcRelDefinesByProperties>()
            .Select(r => r.RelatingPropertyDefinition)
            .OfType<IIfcElementQuantity>();

        public static bool HasAnyPset(IIfcProduct p) => GetPropertySets(p).Any();
        public static bool HasAnyQto(IIfcProduct p) => GetQuantitySets(p).Any();
        public static bool HasPset(IIfcProduct p, string psetName) =>
            GetAllPropertySets(p)
            .Any(ps => ps.Name?.ToString() == psetName);

        public static bool HasQto(IIfcProduct p, string qtoName) =>
            GetAllQuantitySets(p)
            .Any(q => q.Name?.ToString() == qtoName);
    }
}
