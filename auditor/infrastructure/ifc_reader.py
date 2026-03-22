import ifcopenshell

from core.model import ElementInfo

def load_ifc_elements(file_path: str) -> list[ElementInfo]:
    # Open an IFC file and extract ElementInfo objects.
    model = ifcopenshell.open(file_path)

    elements = model.by_type("IfcProduct")

    results: list[ElementInfo] = []

    for element in elements:

        global_id = element.GlobalId
        ifc_class = element.is_a()
        name = element.Name
        
        info = ElementInfo(
            global_id=global_id,
            ifc_class=ifc_class,
            name=name
        )

        results.append(info)
    
    return results