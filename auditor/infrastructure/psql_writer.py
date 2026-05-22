from __future__ import annotations

import psycopg2
import psycopg2.extras
from datetime import datetime, timezone
from typing import Any
from core.model import AuditReport

# This will eventually move to .env file after AWS
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "ifcqa",
    "user": "ifcqa",
    "password": "ifcqa123",
}

# region WRITE

def write_postgres_report(report: AuditReport) -> None:
    """Write the audit report into PostgreSQL."""
    conn = _get_connection()
    try:
        _create_tables(conn)
        audit_run_id = _insert_audit_run(conn, report)
        _insert_element_counts(conn, audit_run_id, report)
        _insert_issues(conn, audit_run_id, report)
        conn.commit()
    finally:
        conn.close()
# endregion
# region QUERY 

def query_runs() -> list[dict[str, Any]]:
    """Return all audit runs, most recent first."""
    conn = _get_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            """
                SELECT id, source_file, run_timestamp, total_elements, total_issues
                FROM audit_runs
                ODER BY run_timestamp DESC
            """
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def query_issues_by_run(run_id: int) -> list[dict[str, Any]]:
    """Return all issues for a specific audit run."""
    conn = _get_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            """
                SELECT
                    id, issue_code, severity, message, global_id,
                    ifc_class, element_name, path, expected, actual, source
                FROM issues
                WHERE audit_run = %s
                ORDER BY ifc_class ASC, issue_code ASC
            """,
            (run_id,),
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def query_issue_summary() -> list[dict[str, Any]]:
    """Return issue counts grouped by issue_code across all audit runs."""

    conn = _get_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
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

def query_issue_by_class() -> list[dict[str, Any]]:
    """Return issue counts grouped by IFC class across all audit runs"""

    conn = _get_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
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

def query_issue_summary_latest() -> list[dict[str, Any]]:
    """Return issue counts by issue_code for the most recent audit run."""
    
    conn = _get_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
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
        
def query_issues_by_class_latest() -> list[dict[str, Any]]:
    """Return issue counts by IFC class for the most recent audit run."""
    
    conn = _get_connection()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictConnection)
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

# region PRIVATE HELPER
# File path logic
def _get_connection():
    return psycopg2.connect(**DB_CONFIG)

def _create_tables(conn) -> None:
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS audit_runs (
            id              SERIAL      PRIMARY KEY,
            source_file     TEXT        NOT NULL,
            run_timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            total_elements  INTEGER     NOT NULL,
            total_issues    INTEGER     NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS element_counts (
            id              SERIAL      PRIMARY KEY,
            audit_run_id    INTEGER     NOT NULL,
            ifc_class       TEXT        NOT NULL,
            element_count   INTEGER     NOT NULL,
            FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS issues (
            id              SERIAL PRIMARY KEY,
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
    
def _insert_audit_run(conn, report: AuditReport) -> int:
    cursor = conn.cursor()
    run_timestamp = datetime.now(timezone.utc)
    cursor.execute(
        """
        INSERT INTO audit_runs (source_file, run_timestamp, total_elements, total_issues)
        VALUES (%s, %s, %s, %s)
        RETURNING id
        """,
        # %s placeholder
        (
            report.source_file,
            run_timestamp,
            report.total_elements,
            report.total_issues,
        ),
    )
    
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError("Failed to retrieve audit_runs row id after insert.")
    
    return row[0]

def _insert_element_counts(conn, audit_run_id: int, report: AuditReport) -> None:
    cursor = conn.cursor()
    
    rows =[
        (audit_run_id, ifc_class, count)
        for ifc_class, count in report.counts_by_class.items()
    ]
    
    psycopg2.extras.execute_values(
        cursor,
        """
            INSERT INTO element_counts (audit_run_id, ifc_class, element_count)
            VALUES %s
        """,
        rows,
    )

def _insert_issues(conn, audit_run_id: int, report: AuditReport) -> None:
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
            issue.path,
            issue.expected,
            issue.actual,
            "python",
        )
        for issue in report.issues
    ]
    
    psycopg2.extras.execute_values(
        cursor,
        """
            INSERT INTO issues (
                audit_run_id, issue_code, severity, message,
                global_id, ifc_class, element_name, path,
                expected, actual, source
            )
            VALUES %s
        """,
        rows,
    )

# endregion