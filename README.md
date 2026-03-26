[![IFC QA](https://github.com/tommylee0923/ifc-quality-gate/actions/workflows/ifcqa.yml/badge.svg)](https://github.com/tommylee0923/ifc-quality-gate/actions/workflows/ifcqa.yml)

# IfcQA — IFC Quality Gate for BIM Pipelines

![IfcQA HTML Report](docs/images/report-overview.png)

**IfcQA** is a lightweight **IFC quality-gate CLI** built with **C# / .NET / xBIM toolkit**. It validates BIM models against configurable rulesets and generates interactive HTML reports with a 3D model viewer that links QA issues directly to the elements.

Live Interactive Demo: https://www.leetommy.com/ifcqa-tool/

---

## Key Features

### Rule-based IFC QA Engine
- Modular C# rule system built on xBIM and JSON-driven rulesets
- Validates properties, naming, containment, and consistency
- Emits structured issues with severity + trace metadata
- Summary metrics + filterable issue table

### Interactive, Zero-Backend HTML QA Report
- Fully static HTML report (no server required)
- Embedded Three.js GLB viewer with preserved GlobalId mapping
- Issue ↔ Element synchronization
- Hover highlight, click selection, and detail drawer interaction
- Draggable split-pane UI for review workflows

### CLI-First, Automation-Friendly
- Deterministic and reproducible output
- `--fail-on` threshold support for CI gating
- Designed for local QA, model audits, and pipeline integration

### SQLite Integration — Shared Data Layer
- `--sqlite` flag writes structured results into a shared `audit.db`
- Compatible with the IfcModelAuditor Python pipeline's SQLite schema
- Enables multi-engine comparison: IfcQA and Python auditor results
  in one queryable database, surfaced through a unified web interface
- Issues stored with full trace metadata: severity, path, expected,
  actual, source engine

---

## Architecture

### Validation Engine
- C# / .NET
- xBIM Toolkit

### IFC Model Processing
- IfcOpenShell (IfcConvert) — IFC → GLB export

### Report Output
- Three.js — GLB rendering & scene graph indexing
- Static HTML / CSS / JS (zero-backend distribution)

### Shared Data Layer (optional)
- SQLite — shared schema with IfcModelAuditor Python pipeline
- `source='ifcqa'` written on all issue rows for engine identification
- See [IfcModelAuditor](https://github.com/tommylee0923/IfcModelAuditor)
  for the unified web interface

---

## Quickstart (Windows)

1. Download and unzip the Windows release.
2. Open Terminal in the extracted folder and run:

```powershell
# (Optional) initialize a local workspace (rulesets + report templates)
# and outputs in a folder named "Demo"
.\ifcqa.exe init -o Demo

# Run QA checks + generate interactive report (3D viewer enabled)
.\ifcqa.exe check PATH_TO_MODEL.ifc -o Demo\out --viewer

# Run QA checks + write results to shared SQLite database
.\ifcqa.exe check PATH_TO_MODEL.ifc -o Demo\out --sqlite

# Combine both flags
.\ifcqa.exe check PATH_TO_MODEL.ifc -o Demo\out --viewer --sqlite

# (Optional) specify ruleset:
# .\ifcqa.exe check PATH_TO_MODEL.ifc -o Demo\out -r Demo\rulesets\PICK_A_RULESET_HERE --viewer
```

3. Open `Demo\out\report.html` in your browser

**Outputs:**
- `report.html` — interactive QA report
- `report.json` — structured run summary
- `issues.json` — full issue list
- `issues.csv` — issue list as CSV
- `audit.db` — SQLite database (when `--sqlite` is passed)
- `model.glb` — generated when `--viewer` is enabled
- `viewer/` — viewer assets copied from `Report/Templates/viewer`

---

## SQLite Integration

IfcQA can write results into a shared SQLite database alongside the
[IfcModelAuditor](https://github.com/tommylee0923/IfcModelAuditor)
Python auditor. Both engines write to the same `audit.db` file using
a common schema, making it possible to query and compare results from
both tools in one place.

```powershell
# Run IfcQA with SQLite output, pointing at a shared output directory
.\ifcqa.exe check model.ifc -o shared\output --sqlite

# Run the Python auditor against the same directory
python auditor/app/main.py audit model.ifc --output shared/output

# Launch the unified web interface
python auditor/app/server.py
```

The shared `issues` table includes a `source` column (`'python'` or
`'ifcqa'`) so results from each engine can be filtered and compared
in the web application.

---

## CI Quality Gate (GitHub Actions)

This repo includes a GitHub Actions workflow that runs IfcQA against
a sample IFC on every push/PR and uploads the generated `report.html`
as a build artifact.

---

## Project Structure

```
ifcqa-tool/
├─ src/
│   ├─ IfcQa.Core/
│   │   ├─ Rules/           Rule engine + validation logic
│   │   ├─ Models/          Issue models + trace metadata
│   │   ├─ Analysis/        IFC analysis orchestration
│   │   └─ IFC utilities/   xBIM-based helpers
│   │
│   └─ IfcQa.Cli/
│       ├─ Program.cs
│       ├─ HtmlReportWriter.cs
│       ├─ SqliteWriter.cs  Shared SQLite output (--sqlite flag)
│       └─ Report/
│           └─ Templates/
│               ├─ report.template.html
│               ├─ report.css
│               ├─ report.js
│               └─ viewer/
│                   ├─ viewer.bundle.js
│                   ├─ app.js
│                   └─ modules/
│
├─ auditor/                     ← Python auditor
│   ├─ app/
│   │   ├─ main.py              CLI (audit + query subcommands)
│   │   └─ server.py            Flask API
│   ├─ core/
│   │   ├─ model.py             ElementInfo, IssueRecord, AuditReport
│   │   └─ auditor.py           Validation logic (MISSING_NAME rule)
│   ├─ infrastructure/
│   │   ├─ ifc_reader.py        IFC parsing via IfcOpenShell
│   │   ├─ sqlite_writer.py     SQLite write + query layer
│   │   ├─ json_writer.py
│   │   ├─ csv_writer.py
│   │   └─ console_writer.py
│   └─ web/
│       ├─ index.html
│       ├─ style.css
│       └─ app.js
│
├─ output/                      Shared output dir (audit.db lives here)
├─ samples/                     Shared IFC sample files
└─ rulesets/                    IfcQA JSON rulesets
```

---

## Status & Milestones

Active development.

- v0.4.0 — Static HTML QA report
- v0.5.0 — Interactive GLB viewer + UX improvement
- v0.6.0 — SQLite integration for shared multi-engine data layer

Scoped to demonstrate **AEC software engineering**, **BIM reasoning**,
and **production-quality tooling** without vendor lock-in.