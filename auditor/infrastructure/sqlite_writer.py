from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from core.model import AuditReport

# ========================================================================
# PUBLIC WRITE FUNCTION
# ========================================================================


def write_sqlite_report(report: AuditReport, output_dir: Path) -> Path:
    """Write the audit report into a SQLite database file."""

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    db_path = _get_write_path(output_dir)

    conn = sqlite3.connect(db_path)
    try:
        _create_tables(conn)
        _migrate_schema(conn)
        audit_run_id = _insert_audit_run(conn, report)
        _insert_element_counts(conn, audit_run_id, report)
        _insert_issues(conn, audit_run_id, report)
        conn.commit()
    finally:
        conn.close()

    return db_path

# ========================================================================
# PUBLIC QUERY FUNCTION
# ========================================================================

def query_runs(output_dir: Path) -> list[dict[str, Any]]:
    """Return all audit runs, most recent first."""
    
    db_path = _get_read_path(output_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                id,
                source_file,
                run_timestamp,
                total_elements,
                total_issues
            FROM audit_runs
            ORDER BY run_timestamp DESC
            """
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def query_issues_by_run(output_dir: Path, run_id: int) -> list[dict[str, Any]]:
    """Return all issues for a specific audit run."""
    
    db_path = _get_read_path(output_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                id,
                issue_code,
                severity,
                message,
                global_id,
                ifc_class,
                element_name,
                path,
                expected,
                actual,
                source
            FROM issues
            WHERE audit_run_id = ?
            ORDER BY ifc_class ASC, issue_code ASC
            """,
            (run_id,),
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()
        

def query_issue_summary(output_dir: Path) -> list[dict[str, Any]]:
    """Return issue counts grouped by issue_code across all audit runs."""

    db_path = _get_read_path(output_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                issue_code,
                COUNT(*) AS total
            FROM issues
            GROUP BY issue_code
            ORDER BY total DESC, issue_code ASC
            """
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def query_issue_by_class(output_dir: Path) -> list[dict[str, Any]]:
    """Return issue counts grouped by IFC class across all audit runs"""

    db_path = _get_read_path(output_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                COALESCE(ifc_class, 'Unknown') AS ifc_class,
                COUNT (*) AS total
            FROM issues
            GROUP BY COALESCE(ifc_class, 'Unknown')
            ORDER BY total DESC, ifc_class ASC
            """
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def query_issue_summary_latest(output_dir: Path) -> list[dict[str, Any]]:
    """Return ussye counts by issue_code for the most recent audit run."""
    
    db_path = _get_read_path(output_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                i.issue_code,
                COUNT(*) AS total
            FROM issues i
            WHERE i.audit_run_id = (
                SELECT MAX(id) FROM audit_runs
            )
            GROUP BY i.issue_code
            ORDER BY total DESC, i.issue_code ASC
            """
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def query_issues_by_class_latest(output_dir: Path) -> list[dict[str, Any]]:
    """Return issue counts by IFC class for the most recent audit run."""
    
    db_path = _get_read_path(output_dir)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                COALESCE(i.ifc_class, 'Unknown') AS ifc_class,
                COUNT(*) AS total
            FROM issues i
            WHERE i.audit_run_id = (
                SELECT MAX(id) FROM audit_runs
            )
            GROUP BY COALESCE(i.ifc_class, 'Unknown')
            ORDER BY total DESC, ifc_class ASC
            """
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()
        
# ========================================================================
# PRIVATE HELPERS
# ========================================================================


def _create_tables(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_runs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file     TEXT    NOT NULL,
            run_timestamp   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            total_elements  INTEGER NOT NULL,
            total_issues    INTEGER NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS element_counts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            audit_run_id    INTEGER NOT NULL,
            ifc_class       TEXT    NOT NULL,
            element_count   INTEGER NOT NULL,
            FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS issues (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            audit_run_id    INTEGER NOT NULL,
            issue_code      TEXT    NOT NULL,
            severity        TEXT,
            message         TEXT    NOT NULL,
            global_id       TEXT    NOT NULL,
            ifc_class       TEXT,
            element_name    TEXT,
            path            TEXT,
            expected        TEXT,
            actual          TEXT,
            source          TEXT    NOT NULL DEFAULT 'python',
            FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
        )
        """
    )

def _migrate_schema(conn: sqlite3.Connection) -> None:
    new_columns = [
        ("severity",    "TEXT"),
        ("path",        "TEXT"),
        ("expected",    "TEXT"),
        ("actual",      "TEXT"),
        ("source",      "TEXT NOT NULL DEFAULT 'python'"),
    ]
    
    cursor = conn.cursor()
    for column_name, column_def in new_columns:
        try:
            cursor.execute(
                f"ALTER TABLE issues ADD COLUMN {column_name} {column_def}"
            )
        except sqlite3.OperationalError:
            pass

def _insert_audit_run(conn: sqlite3.Connection, report: AuditReport) -> int:
    cursor = conn.cursor()
    run_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        """
        INSERT INTO audit_runs (source_file, run_timestamp, total_elements, total_issues)
        VALUES (?, ?, ?, ?)
        """,
        (
            report.source_file,
            run_timestamp,
            report.total_elements,
            report.total_issues,
        ),
    )

    lastrowid = cursor.lastrowid
    if lastrowid is None:
        raise RuntimeError("Failed to retrieve audit_runs row id after insert.")
    
    return lastrowid

def _insert_element_counts(
        conn: sqlite3.Connection,
        audit_run_id: int,
        report: AuditReport,
) -> None:
    cursor = conn.cursor()

    rows = [
        (audit_run_id, ifc_class, count)
        for ifc_class, count in report.counts_by_class.items()
    ]

    cursor.executemany(
        """
        INSERT INTO element_counts (audit_run_id, ifc_class, element_count)
        VALUES (?, ?, ?)
        """,
        rows,
    )

def _insert_issues(
        conn: sqlite3.Connection,
        audit_run_id: int,
        report: AuditReport,
) -> None:
    cursor = conn.cursor()

    rows = [
        (
            audit_run_id,
            issue.issue_code,
            issue.severity,
            issue.message,
            issue.global_id,
            issue.ifc_class,
            issue.element_name,
            None,       # path
            None,       # expected
            None,       # actual
            "python,"   # source
        )
        for issue in report.issues
    ]

    cursor.executemany(
        """
        INSERT INTO issues (
            audit_run_id,
            issue_code,
            severity,
            message,
            global_id,
            ifc_class,
            element_name,
            path,
            expected,
            actual,
            source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )

def _get_write_path(output_dir: Path) -> Path:
    return Path(output_dir) / "audit.db"

def _get_read_path(output_dir: Path) -> Path:
    db_path = Path(output_dir) / "audit.db"
    if not db_path.exists():
        raise FileNotFoundError(
            f"SQLite database not found at {db_path}. "
            "Run an audit first to generate it."
        )
    return db_path