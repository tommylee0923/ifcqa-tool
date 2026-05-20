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
            element_count   INTEGER     NOT NULL
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