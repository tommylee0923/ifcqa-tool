from pathlib import Path
from flask import Flask, jsonify, abort, send_from_directory

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
OUTPUT_DIR = Path(__file__).parent.parent / "output"

# ========================================================================
# ROOT ROUTES
# ========================================================================

@app.route("/")
def index():
    """Serve the web app entry point."""
    
    return send_from_directory(app.static_folder, "index.html")

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
    """Return all issues for a specific audit run."""
    
    try:
        rows = query_issues_by_run(OUTPUT_DIR, run_id)
        if not rows:
            abort(404, description=f"No issues found for run ID {run_id}.")
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