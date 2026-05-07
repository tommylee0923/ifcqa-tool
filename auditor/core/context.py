from __future__ import annotations

from dataclasses import dataclass, field
from collections import defaultdict
import ifcopenshell

@dataclass
class AuditContext:
    """
    Shared IFC audit context.
    
    Built once per audit run and passed into every rule so rules do not repeatedly
    scan the IFC model.
    """
    
    model: ifcopenshell.file
    all_products: list[ifcopenshell.entity_instance] = field(default_factory=list)
    all_roots: list[ifcopenshell.entity_instance] = field(default_factory=list)
    elements_by_class: dict[str, list[ifcopenshell.entity_instance]] = field(default_factory=dict)
    
    @classmethod
    def from_model(cls, model: ifcopenshell.file) -> "AuditContext":
        products = list(model.by_type("IfcProduct"))
        roots = list(model.by_type("IfcRoot"))
        
        by_class: dict[str, list[ifcopenshell.entity_instance]] = defaultdict(list)
        
        for element in products:
            by_class[element.is_a().lower()].append(element)
            
        return cls(
            model=model,
            all_products=products,
            all_roots=roots,
            elements_by_class=dict(by_class),
        )
    
    def get_elements(self, ifc_class: str) -> list[ifcopenshell.entity_instance]:
        """
        Return elements matching an IFC class name.
        
        Example:
            context.get_elements("IfcWall")
        """
        
        return self.elements_by_class.get(ifc_class.lower(), [])
        