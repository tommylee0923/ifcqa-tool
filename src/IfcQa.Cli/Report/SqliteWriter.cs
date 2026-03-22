using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.Data.Sqlite;
using IfcQa.Core;
using System.Data.Common;
using System.Runtime.CompilerServices;
using System.Globalization;

internal static class SqliteWriter
{
    public static void Write(IfcQaRunResult run, string outputDir)
    {
        var issues = run.Issues ?? new List<Issue>();

        Directory.CreateDirectory(outputDir);
        var dbPath = Path.Combine(outputDir, "audit.db");

        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = dbPath
        }.ToString();

        using var conn = new SqliteConnection(connectionString);
        conn.Open();

        CreateTables(conn);
        MigrateSchema(conn);

        using var transaction = conn.BeginTransaction();

        var auditRunId = InsertAuditRun(conn, transaction, run, issues);
        InsertIssues(conn, transaction, auditRunId, issues);

        transaction.Commit();
        Console.WriteLine($"Wrote audit.db ({dbPath})");
    }

    // ============================================================
    // PRIVATE — SCHEMA
    // ============================================================

    private static void CreateTables(SqliteConnection conn)
    {
        ExecuteNonQuery(conn, null,
            """
            CREATE TABLE IF NOT EXISTS audit_runs (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                source_file     TEXT    NOT NULL,
                run_timestamp   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                total_elements  INTEGER NOT NULL,
                total_issues    INTEGER NOT NULL
            )
            """
        );

        ExecuteNonQuery(conn, null,
            """
            CREATE TABLE IF NOT EXISTS element_counts (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                audit_run_id        TEXT    NOT NULL,
                ifc_class           TEXT    NOT NULL,
                element_count       INTEGER NOT NULL,
                FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
            )
            """
        );

        ExecuteNonQuery(conn, null,
            """
            CREATE TABLE IF NOT EXISTS issues (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                audit_run_id        TEXT    NOT NULL,
                issue_code          TEXT    NOT NULL,
                severity            TEXT,
                message             TEXT    NOT NULL,
                global_id           TEXT    NOT NULL,
                ifc_class           TEXT    NOT NULL,
                element_name        TEXT    NOT NULL,
                path                TEXT,
                expected            TEXT,
                actual              TEXT,
                source              TEXT    NOT NULL DEFAULT 'python',
                FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
            )
            """
        );
    }

    private static void MigrateSchema(SqliteConnection conn)
    {
        var newColumns = new[]
        {
            ("severity", "TEXT"),
            ("path", "TEXT"),
            ("expected", "TEXT"),
            ("actual", "TEXT"),
            ("source", "TEXT NOT NULL DEFAULT 'python'"),
        };

        foreach (var (columnName, columnDef) in newColumns)
        {
            try
            {
                ExecuteNonQuery(conn, null,
                $"ALTER TABLE issues ADD COLUMN {columnName} {columnDef}"
                );
            }
            catch (SqliteException)
            {
                // Column already exists - skip silently
            }
        }
    }

    // ============================================================
    // PRIVATE — INSERT
    // ============================================================

    private static long InsertAuditRun(
        SqliteConnection conn,
        SqliteTransaction transaction,
        IfcQaRunResult run,
        List<Issue> issues)
    {
        var runTimestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

        using var cmd = conn.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText =
        """
        INSERT INTO audit_runs (source_file, run_timestamp, total_elements, total_issues)
        VALUES ($sourceFile, $runTimestamp, $totalElements, $totalIssues)
        """;

        cmd.Parameters.AddWithValue("$sourceFile", run.IfcPath);
        cmd.Parameters.AddWithValue("$runTimestamp", runTimestamp);
        cmd.Parameters.AddWithValue("$totalElements", 0);
        cmd.Parameters.AddWithValue("$totalIssues", issues.Count);

        cmd.ExecuteNonQuery();

        using var idCmd = conn.CreateCommand();
        idCmd.Transaction = transaction;
        idCmd.CommandText = "SELECT last_insert_rowid()";

        return (long)(idCmd.ExecuteScalar() ?? throw new InvalidOperationException(
            "Failed to retrieve audit_run row ID after insert."
        ));
    }

    private static void InsertIssues(
        SqliteConnection conn,
        SqliteTransaction transaction,
        long auditRunId,
        List<Issue> issues)
    {
        if (issues.Count == 0) return;

        using var cmd = conn.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText =
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
            VALUES (
                $auditRunId,
                $issueCode,
                $severity,
                $message,
                $globalId,
                $ifcClass,
                $elementName,
                $path,
                $expected,
                $actual,
                $source
            )
            """;

        cmd.Parameters.AddWithValue("$auditRunId", auditRunId);
        cmd.Parameters.AddWithValue("$issueCode", "");
        cmd.Parameters.AddWithValue("$severity", "");
        cmd.Parameters.AddWithValue("$message", "");
        cmd.Parameters.AddWithValue("$globalId", "");
        cmd.Parameters.AddWithValue("$ifcClass", "");
        cmd.Parameters.AddWithValue("$elementName", DBNull.Value);
        cmd.Parameters.AddWithValue("$path", DBNull.Value);
        cmd.Parameters.AddWithValue("$expected", DBNull.Value);
        cmd.Parameters.AddWithValue("$actual", DBNull.Value);
        cmd.Parameters.AddWithValue("$source", "ifcqa");

        foreach (var issue in issues)
        {
            cmd.Parameters["$issueCode"].Value = issue.RuleId;
            cmd.Parameters["$severity"].Value = issue.Severity.ToString();
            cmd.Parameters["$message"].Value = issue.Message;
            cmd.Parameters["$globalId"].Value = issue.GlobalId;
            cmd.Parameters["$ifcClass"].Value = issue.IfcClass;

            cmd.Parameters["$elementName"].Value = (object?)issue.Name ?? DBNull.Value;
            cmd.Parameters["$path"].Value = (object?)issue.Path ?? DBNull.Value;
            cmd.Parameters["$expected"].Value = (object?)issue.Expected ?? DBNull.Value;
            cmd.Parameters["$actual"].Value = (object?)issue.Actual ?? DBNull.Value;

            cmd.ExecuteNonQuery();
        }
    }

    // ============================================================
    // PRIVATE — UTILITIES
    // ============================================================

    private static void ExecuteNonQuery(
        SqliteConnection conn,
        SqliteTransaction? transaction,
        string sql)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = transaction;
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }
}