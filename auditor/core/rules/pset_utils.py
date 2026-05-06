from __future__ import annotations
import ifcopenshell
import ifcopenshell.util.element

# ========================================================================
# PROPERTY SET HELPERS
# ========================================================================

def get_psets(element: ifcopenshell.entity_instance) -> dict[str, dict]:
    """
    Return all property sets for an element, including type-inherited psets.
    Returns a dict of {pset_name: {key: value, ...}}.
    Values are already unwrapped to Python primitives by IfcOpenShell.
    """
    
    return ifcopenshell.util.element.get_psets(element, psets_only=True)

def get_pset_value(element: ifcopenshell.entity_instance, pset_name: str, key: str) -> str | None:
    """
    Return a single pset property value as a stripped string, or None if missing.
    Checks instance psets first, then type psets.
    """

    psets = get_psets(element)
    ps = psets.get(pset_name)
    if ps is None:
        return None
    val = ps.get(key)
    if val is None:
        return None
    return str(val).strip()

def has_pset(element:ifcopenshell.entity_instance, pset_name: str) -> bool:
    """
    Return True if element has a property set with the given name.
    """
    return pset_name in get_psets(element)

def get_attribute(element: ifcopenshell.entity_instance, attribute: str) -> str | None:
    """
    Return a direct IFC attribute value as a stripped string, or None if missing.
    """

    val = getattr(element, attribute, None)
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None

# ========================================================================
# QUANTITY SET HELPERS
# ========================================================================

def get_qtos(element: ifcopenshell.entity_instance) -> dict[str, dict]:
    """
    Return all quantity set for an element.
    Returns a dict of {qto_name: {qty_name: vaue, ...}}.
    """

    return ifcopenshell.util.element.get_psets(element, qtos_only=True)

def get_qto_value(element: ifcopenshell.entity_instance, qto_name: str, qty_name: str) -> float | None:
    """
    Return a single quantity value as a float, or None if missing.
    """

    qtos = get_qtos(element)
    qto = qtos.get(qto_name)

    if qto is None:
        return None
    
    val = qto.get(qty_name)
    if val is None:
        return None
    
    try:
        return float(val)
    except (TypeError, ValueError):
        return None
    
def has_qto(element: ifcopenshell.entity_instance, qto_name: str) -> bool:
    """
    Return True if the element has a quantity set with the given name.
    """

    return qto_name in get_qtos(element)

# ========================================================================
# TYPE PSET HELPERS (for RequireInstanceEqualsType)
# ========================================================================

def get_type_psets(element: ifcopenshell.entity_instance) -> dict[str, dict]:
    """
    Return only the type-level property sets for an element.
    Useful when comparing instance vs type values
    """

    element_type = ifcopenshell.util.element.get_type(element)
    if element_type is None:
        return {}
    
    return ifcopenshell.util.element.get_psets(element_type, psets_only=True)

def get_instance_psets(element: ifcopenshell.entity_instance) -> dict[str, dict]:
    """
    Return only the instance-level property sets, excluding type inheritance.
    """

    return ifcopenshell.util.element.get_psets(element, psets_only=True, should_inherit=False)