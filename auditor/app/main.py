import ifcopenshell
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from infrastructure.ifc_reader import load_ifc_elements
from infrastructure.console_writer import write_console_report
from infrastructure.json_writer import write_json_report
from infrastructure.csv_writer import write_csv_report
from infrastructure.glb_converter import convert_ifc_to_glb
from infrastructure.psql_writer import (
    write_postgres_report,
    query_runs,
    query_issues_by_run,
    query_issue_summary_latest,
    query_issues_by_class_latest,
    )
from infrastructure.seed_rulesets import run_seed
from core.auditor import run_audit as run_core_audit
from core.pipeline import run_audit_pipeline

# region Argument parsing
# ========================================================================
# ARGUMENT PARSING
# ========================================================================

def parse_arguments() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="IFC Model Auditor CLI"
    )

    subparsers = parser.add_subparsers(dest="command")

    # audit
    audit_parser = subparsers.add_parser(
        "audit",
        help="Run anaudit on an IFC file"
    )
    audit_parser.add_argument(
        "ifc_file",
        help="Path to the IFC file"
    )
    
    audit_parser.add_argument(
        "--output",
        default="output",
        help="Output directory for reports (default: output)"
    )
    
    audit_parser.add_argument(
        "--ruleset",
        help="Path to a JSON ruleset file"
    )
    
    audit_parser.add_argument(
        "--viewer",
        action="store_true",
        help="Convert IFC to GLB for the 3D viewer"
    )

    audit_parser.add_argument(
        "--no-console",
        action="store_true",
        help="Disable console report output"
    )

    audit_parser.add_argument(
        "--no-json",
        action="store_true",
        help="Disable JSON report output"
    )

    audit_parser.add_argument(
        "--no-csv",
        action="store_true",
        help="Disable CSV report output"
    )

    audit_parser.add_argument(
        "--no-sqlite",
        action="store_true",
        help="Disable SQLite report output"
    )

    # query
    query_parser = subparsers.add_parser(
        "query",
        help="Query the SQLite audit databse"
    )

    query_parser.add_argument(
        "--output",
        default="output",
        help="Output directory containing dubit.db (default: output)"
    )

    query_group = query_parser.add_mutually_exclusive_group()
    query_group.add_argument(
        "--runs",
        action="store_true",
        help="List all audit runs."
    )
    
    query_group.add_argument(
        "--issues-by-run",
        type=int,
        metavar="RUN_ID",
        help="Show all issues for a specific run ID."
    )
    
    query_group.add_argument(
        "--issue-summary",
        action="store_true",
        help="Show issue counts grouped by issue code. (latest run)"
    )

    query_group.add_argument(
        "--issues-by-class",
        action="store_true",
        help="Show issue counts grouped by IFC class. (latest run)"
    )
    
    subparsers.add_parser(
        "seed",
        help="Seed the database with rule types and built-in rulesets"
    )

    return parser

# region Print Helpers
# ========================================================================
# PRINT HELPERS
# ========================================================================

def print_runs(rows: list[dict]) -> None:
    print("Audit Runs")
    print("-" * 50)
    
    if not rows:
        print("No ausit runs found.")
        return
    
    for row in rows:
        print(f"[{row['id']}] {row['source_file']}")
        print(f"    Timestamp: {row['run_timestamp']}")
        print(f"    Element: {row['total_elements']}")
        print(f"    Issues: {row['total_issues']}")
        print()

def print_issues_by_run(rows: list[dict], run_id: int) -> None:
    print(f"Issues for Run ID: {run_id}")
    print("-" * 50)
    
    if not rows:
        print("No issues found for this run.")
        return

    for row in rows:
        print(f"[{row['issue_code']}] Severity: {row['severity']} | {row['ifc_class']}")
        print(f"    Name: {row['element_name']}")
        print(f"    Message: {row['message']}")
        print(f"    GlobalID: {row['global_id']}")
        print()

def print_issue_summary(rows: list[dict]) -> None:
    print("Issue Sumamry (latest run)")
    print("-" * 50)

    if not rows:
        print("No issues found.")
        return
    
    for row in rows:
        print(f"{row['issue_code']}: {row['total']}")

def print_issue_by_class(rows: list[dict]) -> None:
    print("Issue by IFC Class (latest run)")
    print("-" * 50)

    if not rows:
        print("No issues found.")
        return
    
    for row in rows:
        print(f"{row['ifc_class']}: {row['total']}")

# region Command handlers
# ========================================================================
# COMMAND HANDLERS
# ========================================================================

def run_audit(args) -> None:
    ifc_path = Path(args.ifc_file)
    output_dir = Path(args.output)
    
    if not ifc_path.exists():
        raise FileNotFoundError(f"IFC file not found at: {ifc_path}")
    
    ruleset_path = Path(args.ruleset) if args.ruleset else None
    
    if ruleset_path and not ruleset_path.exists():
        raise FileNotFoundError(f"Ruleset file not found at: {ruleset_path}")
    
    print (f"Reading IFC file: {ifc_path}")
    
    report = run_audit_pipeline(ifc_path, ruleset_path)    
    print(f"Audit complete: {report.total_elements} elements, {report.total_issues} issues")
    
    if not args.no_console:
        write_console_report(report)
    
    if not args.no_json:
        write_json_report(report, str(output_dir / "audit_report.json"))
                          
    if not args.no_csv:
        write_csv_report(report, str(output_dir))
    
    if not args.no_sqlite:
        write_postgres_report(report)
        
    if args.viewer:
        convert_ifc_to_glb(str(ifc_path), str(output_dir))
        
    print(f"Outputs written to {output_dir}")


def run_query(args) -> None:
    output_dir = Path(args.output)

    if args.runs:
        rows = query_runs()
        print_runs(rows)
        return
    
    if args.issues_by_run is not None:
        rows = query_issues_by_run(args.issues_by_run)
        return
    
    if args.issue_summary:
        rows = query_issue_summary_latest()
        print_issue_summary(rows)
        return

    if args.issues_by_class:
        rows = query_issues_by_class_latest()
        print_issue_by_class(rows)
        return

    print("No query option selected.")
    print("Use --runs, --issues-by-run <id>, --issue-summary, or --issue-by-class.")

def run_seed_command() -> None:
    print("Seeding database...")
    run_seed()
    print("Seed complete.")

# region Entry point
# ========================================================================
# ENTRY POINT
# ========================================================================

def main() -> None:
    parser = parse_arguments()
    args = parser.parse_args()

    if args.command == "audit":
        run_audit(args)
    elif args.command == "query":
        run_query(args)
    elif args.command == "seed":
        run_seed_command()
    else:
        parser.print_help()
    
if __name__ == "__main__":
    main()