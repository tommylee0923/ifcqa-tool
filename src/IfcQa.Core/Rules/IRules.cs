using System.Collections.Generic;
using Xbim.Ifc;

namespace IfcQa.Core.Rules;

public interface IRule
{
    string Id { get; }
    Severity Severity { get; }
    IEnumerable<Issue> Evaluate(IfcStore model);
}