import sys
from pathlib import Path
from flask import Flask, jsonify, abort, send_from_directory, request

sys.path.insert(0, str(Path(__file__).parent.parent))

from infrastructure.psql_writer import (
    query_runs,
    query_issues_by_run,
    query_issue_summary_latest,
    query_issues_by_class_latest,
)
from core.pipeline import run_audit_pipeline

# ========================================================================
# APP SETUP
# ========================================================================

BASE_DIR = Path(__file__).parent.parent.parent
app = Flask(__name__, static_folder=str(BASE_DIR / "frontend" / "dist"), static_url_path="")
OUTPUT_DIR = Path("/app/output") if Path("/app/output").exists() else Path(__file__).parent.parent.parent / "output"
RULESET_DIR = BASE_DIR / "rulesets"
DEFAULT_RULESET = RULESET_DIR / "revit-export.json"

# ========================================================================
# ROOT ROUTES
# ========================================================================

@app.route("/")
def index():
    """Serve the web app entry point."""
    if app.static_folder is None:
        abort(500, description="Static folder is not configured.")
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def catch_all(path):
    return send_from_directory(app.static_folder, "index.html")

# ========================================================================
# MODEL ROUTES
# ========================================================================

@app.route("/model/<filename>")
def serve_glb(filename):
    """Serve the GLB model file from the shared output directory"""
    
    if not filename.endswith(".glb"):
        abort(400, description="Only .glb files are served here")
    glb_path =  OUTPUT_DIR / filename
    if not glb_path.exists():
        abort(404, description="{filename} not found in the output directory. Run audit with --viewer flag first.")
    return send_from_directory(str(OUTPUT_DIR), filename)

# ========================================================================
# API ROUTES
# ========================================================================

@app.route("/runs", methods=["GET"])
def get_runs():
    """Return all audit runs, most recent first."""
    
    try:
        rows = query_runs()
        for run in rows:
            stem = Path(run["source_file"]).stem
            run["glb_filename"] = f"{stem}.glb"
        return jsonify(rows)
    except FileNotFoundError as e:
        abort(404, description=str(e))

@app.route("/runs/<int:run_id>/issues", methods=["GET"])
def get_issues_by_run(run_id: int):
    """Return all issues for a specific audit run.
    
    Optional query parameter:
        ?source=python      - return only Python auditor issues
        ?source=ifcqa       - return only IfcQA issues
    """
    
    try:
        rows = query_issues_by_run(run_id)
        source = request.args.get("source")
        if source:
            rows = [r for r in rows if r.get("source") == source]
        return jsonify(rows)
    except FileNotFoundError as e:
        abort(404, description=str(e))

@app.route("/runs/<int:run_id>/summary", methods=["GET"])
def get_issue_summary(run_id: int):
    """Return issue counts grouped by issue code for the latest run."""
    
    try:
        rows = query_issue_summary_latest()
        return jsonify(rows)
    except FileNotFoundError as e:
        abort(404, description=str(e))
    
@app.route("/runs/<int:run_id>/issues/by-class", methods=["GET"])
def get_issues_by_class(run_id:int):
    """Return issue counts grouped by IFC clas for the latest run."""
    
    try:
        rows = query_issues_by_class_latest()
        return jsonify(rows)
    except FileNotFoundError as e:
        abort(404, description=str(e))
        
# ========================================================================
# ENTRY POINT
# ========================================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)