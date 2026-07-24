import sys
import tempfile
import shutil
import traceback
import json
from pathlib import Path
from flask import Flask, jsonify, abort, send_from_directory, request
import os

sys.path.insert(0, str(Path(__file__).parent.parent))

from infrastructure.glb_converter import convert_ifc_to_glb
from infrastructure.psql_writer import (
    query_runs,
    query_issues_by_run,
    query_issue_summary_latest,
    query_issues_by_class_latest,
    query_rulesets,
    query_ruleset_by_id,
    insert_ruleset,
    delete_ruleset,
    write_postgres_report,
)
from core.pipeline import run_audit_pipeline
from core.model import AuditReport
from core.llm.composer import generate_ruleset

# ========================================================================
# APP SETUP
# ========================================================================

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    import warnings
    warnings.warn(
        "ANTHROPIC_API_KEY is not set. The LLM composer will not function.",
        RuntimeWarning
    )

BASE_DIR = Path(__file__).parent.parent.parent
app = Flask(
    __name__, static_folder=str(BASE_DIR / "frontend" / "dist"), static_url_path=""
)
OUTPUT_DIR = (
    Path("/app/output")
    if Path("/app/output").exists()
    else Path(__file__).parent.parent.parent / "output"
)
RULESET_DIR = Path("/rulesets") if Path("/rulesets").exists() else BASE_DIR / "rulesets"
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
    if app.static_folder is None:
        abort(500, description="Static folder is not configured.")
    return send_from_directory(app.static_folder, "index.html")


# ========================================================================
# MODEL ROUTES
# ========================================================================


@app.route("/model/<filename>")
def serve_glb(filename):
    """Serve the GLB model file from the shared output directory"""

    if not filename.endswith(".glb"):
        abort(400, description="Only .glb files are served here")
    glb_path = OUTPUT_DIR / filename
    if not glb_path.exists():
        abort(
            404,
            description="{filename} not found in the output directory. Run audit with --viewer flag first.",
        )
    return send_from_directory(str(OUTPUT_DIR), filename)


# ========================================================================
# UPLOAD ROUTES
# ========================================================================

# TODO: update write_postgres_report() to return run_id directly instead of
# re-querying query_runs() to fetch the latest.


@app.route("/upload", methods=["POST"])
def upload():
    """Accept an IFC file, run the audit pipeline, persist results."""

    if "ifc_file" not in request.files:
        abort(400, description="No IFC file provided.")

    ifc_file = request.files["ifc_file"]
    if not ifc_file.filename or not ifc_file.filename.endswith(".ifc"):
        abort(400, description="Uploaded file must be a .ifc file.")

    ruleset_file = request.files.get("ruleset_file")
    ruleset_id = request.form.get("ruleset_id")
    convert_glb = request.form.get("convert_glb", "true").lower() != "false"

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        ifc_path = tmp / ifc_file.filename
        ifc_file.save(str(ifc_path))

        # Priority: ruleset_id from DB > uploaded ruleset file > default
        if ruleset_id:
            ruleset_data = query_ruleset_by_id(int(ruleset_id))
            if ruleset_data is None:
                abort(404, description=f"Ruleset {ruleset_id} not found.")

            print(f"DEBUG first rule keys: {list(ruleset_data['rules'][0].keys()) if ruleset_data['rules'] else 'no rules'}")
            ruleset_json = _ruleset_row_to_json(ruleset_data)
            ruleset_path = tmp / "selected_ruleset.json"
            with open(ruleset_path, "w") as f:
                json.dump(ruleset_json, f)

        elif ruleset_file and ruleset_file.filename and ruleset_file.filename.endswith(".json"):
            ruleset_path = tmp / ruleset_file.filename
            ruleset_file.save(str(ruleset_path))

        else:
            ruleset_path = DEFAULT_RULESET

        try:
            report = run_audit_pipeline(ifc_path, ruleset_path)
        except Exception as e:
            abort(500, description=f"Audit failed: {str(e)}")

        try:
            write_postgres_report(report)
        except Exception as e:
            abort(500, description=f"Failed to write report: {str(e)}")

        if convert_glb:
            try:
                convert_ifc_to_glb(str(ifc_path), str(OUTPUT_DIR))
            except Exception as e:
                print(f"GLB conversion failed: {e}")

        runs = query_runs()
        latest = runs[0] if runs else None

        return jsonify({
            "run_id": latest["id"] if latest else None,
            "total_elements": report.total_elements,
            "total_issues": report.total_issues,
        }), 201


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
def get_issues_by_class(run_id: int):
    """Return issue counts grouped by IFC clas for the latest run."""

    try:
        rows = query_issues_by_class_latest()
        return jsonify(rows)
    except FileNotFoundError as e:
        abort(404, description=str(e))


# ========================================================================
# RULESET ROUTES
# ========================================================================
@app.route("/rulesets", methods=["GET"])
def get_rulesets():
    """Return all rulesets with rule counts."""
    try:
        rows = query_rulesets()
        return jsonify(rows)
    except Exception as e:
        abort(500, description=str(e))
        
@app.route("/rulesets/<int:ruleset_id>", methods=["GET"])
def get_ruleset(ruleset_id: int):
    """Reutnr a single ruleset wih its full ruels array."""
    try:
        ruleset = query_ruleset_by_id(ruleset_id)
        if ruleset is None:
            abort(404, description=f"Ruleset {ruleset_id} not found.")
        return jsonify(ruleset)
    except Exception as e:
        abort(500, description=str(e))
        
@app.route("/rulesets", methods=["POST"])
def create_ruleset():
    """Save a new ruleset. Used by the LLM composer."""
    data = request.get_json()
    if not data:
        abort(400, description="Request body must be JSON.")

    name = data.get("name")
    if not name:
        abort(400, description="Ruleset must have a name.")

    rules = data.get("rules", [])
    if not rules:
        abort(400, description="Ruleset must have at least one rule.")

    try:
        ruleset_id = insert_ruleset(
            name=name,
            version=data.get("version"),
            description=data.get("description"),
            source="generated",
            rules=rules,
        )
        return jsonify({"ruleset_id": ruleset_id}), 201
    except Exception as e:
        abort(500, description=str(e))

@app.route("/rulesets/compose", methods=["POST"])
def compose_ruleset():
    """Generate a ruleset from a natural language description using the LLM composer."""
    data = request.get_json()
    if not data:
        abort(400, description="Request body must be JSON.")
    
    description = data.get("description", "").strip()
    if not description:
        abort(400, description="A 'description' field is required.")
    
    name = data.get("name", "").strip()
    if not name:
        abort(400, description="A 'name' field is required.")
    
    try:
        valid_rules, errors = generate_ruleset(description)
    except ValueError as e:
        abort(502, description=str(e))
    except Exception as e:
        abort(500, description=f"Composer error: {str(e)}")
    
    if errors:
        return jsonify({
            "error": "Ruleset rejected: one or more generated rules failed validation.",
            "validation_errors": errors,
        }), 422
    
    try:
        ruleset_id = insert_ruleset(
            name=name,
            version=None,
            description=description,
            source="generated",
            rules=valid_rules,
        )
    except Exception as e:
        abort(500, description=f"Failed to save ruleset: {str(e)}")
    
    return jsonify({"ruleset_id": ruleset_id}), 201

@app.route("/rulesets/<int:ruleset_id>", methods=["DELETE"])
def remove_ruleset(ruleset_id: int):
    """Delete a ruleset. Built-in rulesets are protected."""
    try:
        deleted = delete_ruleset(ruleset_id)
        if not deleted:
            abort(403, description="Cannot delete a built-in ruleset or ruleset not found.")
        return jsonify({"deleted": ruleset_id}), 200
    except Exception as e:
        abort(500, description=str(e))

def _ruleset_row_to_json(ruleset_data: dict) -> dict:
    """Convert a Postgres ruleset row (with nested rules) back into the JSON shape run_audit_pipeline expects."""
    rules = []
    for r in ruleset_data["rules"]:
        rule = {
            "type": r["rule_type"],
            "id": r["rule_id"],
            "severity": r["severity"],
        }
        if r["ifc_class"]:
            rule["ifcClass"] = r["ifc_class"]
        if r["pset"]:
            rule["pset"] = r["pset"]
        if r["key"]:
            rule["key"] = r["key"]
        if r["psets"]:
            rule["psets"] = r["psets"]
        if r["pset_a"]:
            rule["psetA"] = r["pset_a"]
        if r["key_a"]:
            rule["keyA"] = r["key_a"]
        if r["pset_b"]:
            rule["psetB"] = r["pset_b"]
        if r["key_b"]:
            rule["keyB"] = r["key_b"]
        if r["qto"]:
            rule["qto"] = r["qto"]
        if r["qty"]:
            rule["qty"] = r["qty"]
        if r["qty_names"]:
            rule["qtyNames"] = r["qty_names"]
        if r["min_exclusive"] is not None:
            rule["minExclusive"] = r["min_exclusive"]
        if r["allowed_values"]:
            rule["allowedValues"] = r["allowed_values"]
        if r["regex"]:
            rule["regex"] = r["regex"]
        if r["attribute"]:
            rule["attribute"] = r["attribute"]
        if r["skip_if_missing"]:
            rule["skipIfMissing"] = r["skip_if_missing"]
        if r["meta_title"] or r["meta_why"] or r["meta_how_to_fix"]:
            rule["meta"] = {
                "title": r["meta_title"],
                "why": r["meta_why"],
                "howToFix": r["meta_how_to_fix"],
            }
        rules.append(rule)

    return {
        "name": ruleset_data["name"],
        "version": ruleset_data.get("version"),
        "description": ruleset_data.get("description"),
        "rules": rules,
    }

# ========================================================================
# ENTRY POINT
# ========================================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
