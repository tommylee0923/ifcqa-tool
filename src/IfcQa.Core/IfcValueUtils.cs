using System;
using System.Globalization;
using System.Security.Cryptography.X509Certificates;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core
{
    public static class IfcValueUtils
    {
        public static string? GetSingleValueAsString(IIfcProperty prop)
        {
            if (prop is not IIfcPropertySingleValue sv) return null;
            var nv = sv.NominalValue;
            return nv?.ToString();
        }

        public static bool? GetSingleValueAsBool(IIfcProperty prop)
        {
            var s = GetSingleValueAsString(prop);
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (string.Equals(s, "T", StringComparison.OrdinalIgnoreCase)) return true;
            if (string.Equals(s, "F", StringComparison.OrdinalIgnoreCase)) return false;

            return null;
        }

        public static double? GetSingleValueAsDouble(IIfcProperty prop)
        {
            var s = GetSingleValueAsString(prop);
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d))
                return d;

            return null;
        }
    }
}
