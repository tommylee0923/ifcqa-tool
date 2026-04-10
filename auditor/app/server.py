import sys
from pathlib import Path
from flask import Flask, jsonify, abort, send_from_directory, request

sys.path.insert(0, str(Path(__file__).parent.parent))

from infrastructure.sqlite_writer import (
    query_runs,
    query_issues_by_run,
    query_issue_summary_latest,
    query_issues_by_class_latest,
)

# ========================================================================
# APP SETUP
# ========================================================================

BASE_DIR = Path(__file__).parent.parent
app = Flask(__name__, static_folder=str(BASE_DIR / "web"), static_url_path="")
OUTPUT_DIR = Path(__file__).parent.parent.parent / "output"

# ========================================================================
# ROOT ROUTES
# ========================================================================

@app.route("/")
def index():
    """Serve the web app entry point."""
    
    return send_from_directory(app.static_folder, "index.html")

# ========================================================================
# MODEL ROUTES
# ========================================================================

@app.route("/model.glb")
def serve_glb():
    """Serve the GLB model file from the shared output directory"""
    
    glb_path = OUTPUT_DIR / "model.glb"
    if not glb_path.exists():
        abort(404, description="model.glb not found in the output directory. Run IfcQA with --viewer flag first.")
    return send_from_directory(str(OUTPUT_DIR), "model.glb")

# ========================================================================
# API ROUTES
# ========================================================================

@app.route("/runs", methods=["GET"])
def get_runs():
    """Return all audit runs, most recent first."""
    
    try:
        rows = query_runs(OUTPUT_DIR)
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
        rows = query_issues_by_run(OUTPUT_DIR, run_id)
        if not rows:
            abort(404, description=f"No issues found for run ID {run_id}.")
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
        rows = query_issue_summary_latest(OUTPUT_DIR)
        return jsonify(rows)
    except FileNotFoundError as e:
        abort(404, description=str(e))
    
@app.route("/runs/<int:run_id>/issues/by-class", methods=["GET"])
def get_issues_by_class(run_id:int):
    """Return issue counts grouped by IFC clas for the latest run."""
    
    try:
        rows = query_issues_by_class_latest(OUTPUT_DIR)
        return jsonify(rows)
    except FileNotFoundError as e:
        abort(404, description=str(e))
        
# ========================================================================
# ENTRY POINT
# ========================================================================

if __name__ == "__main__":
    app.run(debug=True)