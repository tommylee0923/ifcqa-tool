import os
import subprocess
from pathlib import Path

def convert_ifc_to_glb(ifc_path: str, output_dir: str) -> str | None:
    """
    Convert an IFC file to GLB using IfcConvert.
    Skips conversion if the GLB already exists.
    Returns the GLB path on success, None on failure
    """
    
    ifc_stem = Path(ifc_path).stem
    glb_path = os.path.join(output_dir, f"{ifc_stem}.glb")
    
    if os.path.exists(glb_path):
        print(f"GLB already exists, skipping conversion: {glb_path}")
        return glb_path
    
    ifcconvert_exe = os.environ.get("IFCQA_IFCCONVERT", "IfcConvert")
    
    cmd = [ifcconvert_exe, "--use-element-guids", ifc_path, glb_path]
    
    print(f"Generating {ifc_stem}.glb (this may take a while for larger models)...")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print("IfcConvert failed.")
            if result.stderr.strip():
                print(result.stderr.strip())
            return None
        
        print(f"Wrote {ifc_stem}.glb ({glb_path})")
        return glb_path
    except FileNotFoundError:
        print("IfcConvert was not found on Path.")
        print("Install IfcOpenShell and ensure IfcCOnvert is available, or set IFCQA_IFCONVERT=/path/to/IfcConvert")
        return None
    
    except Exception as e:
        print(f"IfcCOnvert error: {e}")
        return None