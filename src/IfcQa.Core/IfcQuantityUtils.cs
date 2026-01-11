using System;
using Xbim.Ifc4.Interfaces;

namespace IfcQa.Core;

public static class IfcQuantityUtils
{
    public static double? GetQuantityValue(IIfcPhysicalQuantity qty)
    {
        if (qty is IIfcQuantityLength qLen) return qLen.LengthValue;
        if (qty is IIfcQuantityArea qArea) return qArea.AreaValue;
        if (qty is IIfcQuantityVolume qVol) return qVol.VolumeValue;
        if (qty is IIfcQuantityCount qCount) return qCount.CountValue;
        if (qty is IIfcQuantityWeight qW) return qW.WeightValue;
        if (qty is IIfcQuantityTime qT) return qT.TimeValue;

        return null;
    }
}