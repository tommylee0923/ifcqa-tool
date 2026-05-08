using System.Collections.Generic;

namespace IfcQa.Core;

public sealed record IfcQaRunResult(string IfcPath, List<Issue> Issues);