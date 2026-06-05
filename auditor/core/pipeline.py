from pathlib import Path
import ifcopenshell

from infrastructure.ifc_reader import load_ifc_elements
from core.auditor import run_audit as run_core_audit
from core.model import AuditReport

def run_audit_pipeline(
    ifc_path: Path,
    ruleset_path: Path | None = None,
) -> AuditReport:
    """
    Core audit pipeline. Loads elements, optionally applies a ruleset, and returns an AuditReport.
    No I/O side effects.
    """
    elements = load_ifc_elements(str(ifc_path))
    
    model = None
    if ruleset_path:
        model = ifcopenshell.open(str(ifc_path))
    
    return run_core_audit(
        elements,
        source_file=str(ifc_path),
        model=model,
        ruleset_path=str(ruleset_path) if ruleset_path else None,
    )