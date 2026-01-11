using System;
using System.Globalization;
using System.Reflection;
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
            if (prop is not IIfcPropertySingleValue sv) return null;

            var nv = sv.NominalValue;
            if (nv == null) return null;

            var s = nv.ToString()?.Trim();
            if (!string.IsNullOrWhiteSpace(s))
            {
                if (bool.TryParse(s, out var b)) return b;

                if (string.Equals(s, ".T.", StringComparison.OrdinalIgnoreCase)) return true;
                if (string.Equals(s, ".F.", StringComparison.OrdinalIgnoreCase)) return false;
                if (string.Equals(s, "T", StringComparison.OrdinalIgnoreCase)) return true;
                if (string.Equals(s, "F", StringComparison.OrdinalIgnoreCase)) return false;
                if (string.Equals(s, "1", StringComparison.OrdinalIgnoreCase)) return true;
                if (string.Equals(s, "0", StringComparison.OrdinalIgnoreCase)) return false;
            }

            var valueProp = nv.GetType().GetProperty("Value", BindingFlags.Public | BindingFlags.Instance);
            if (valueProp != null)
            {
                var val = valueProp.GetValue(nv);

                if (val is bool bb) return bb;

                if (val != null)
                {
                    var vs = val.ToString()?.Trim();
                    if (string.Equals(vs, "TRUE", StringComparison.OrdinalIgnoreCase)) return true;
                    if (string.Equals(vs, "FALSE", StringComparison.OrdinalIgnoreCase)) return false;
                }

            }
            return null;
        }

        public static double? GetSingleValueAsDouble(IIfcProperty prop)
        {
            if (prop is not IIfcPropertySingleValue sv) return null;

            var nv = sv.NominalValue;
            if (nv == null) return null;

            var s = nv.ToString()?.Trim();
            if (!string.IsNullOrWhiteSpace(s))
            {
                s = s.Replace("m2", "", StringComparison.OrdinalIgnoreCase).Trim();

                if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d))
                return d;
            }

            var valueProp = nv.GetType().GetProperty("Value", BindingFlags.Public | BindingFlags.Instance);
            if (valueProp != null)
            {
                var val = valueProp.GetValue(nv);
                if (val is double dd) return dd;
                if (val is float ff) return ff;
                if (val is int i) return i;

                var vs = val?.ToString()?.Trim();
                if (!string.IsNullOrWhiteSpace(vs) && 
                    double.TryParse(vs, NumberStyles.Any, CultureInfo.InvariantCulture, out var dv)) return dv;
            }
            
            return null;
        }
    }
}
