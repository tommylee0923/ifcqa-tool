[![IFC QA](https://github.com/tommylee0923/ifc-quality-gate/actions/workflows/ifcqa.yml/badge.svg)](https://github.com/tommylee0923/ifc-quality-gate/actions/workflows/ifcqa.yml)

# IfcQA — IFC Quality Gate for BIM Pipelines

![IfcQA HTML Report](docs/images/report-overview.png)

**IfcQA** is a lightweight IFC quality-gate and validation framework built primarily with Python and IfcOpenShell.
It validates BIM models against configurable JSON rulesets and generates structured QA outputs including JSON, CSV, SQLite, and interactive 3D web reports.

Live Interactive Demo: https://www.leetommy.com/ifcqa-tool/

---

## Key Features

### Rule-based IFC QA Engine
- Modular Python rule engine built on IfcOpenShell
- JSON-driven validation rulesets
- Extensible rule architecture (property, quantity, regex, comparison, and model traversal rules)
- Structured issue trace metadata (severity, path, expected, actual)

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

### SQLite Integration
- Structured audit results written to SQLite
- Queryable issue history and audit runs
- Shared persistence layer for CLI and web interfaces
- Supports downstream analytics and QA workflows

---

## Architecture

### Validation Engine
- Python
- IfcOpenShell
- JSON-driven modular rule system

### IFC Processing
- IfcOpenShell
- IfcConvert (GLB export)

### Persistence Layer
- SQLite

### Web Interface
- Flask API
- Three.js viewer
- Static HTML / CSS / JS frontend

### Outputs
- JSON
- CSV
- SQLite
- Interactive HTML QA reports

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
├─ auditor/                     ← Primary Python engine
│   ├─ app/
│   ├─ core/
│   │   ├─ rules/
│   │   ├─ model.py
│   │   └─ auditor.py
│   ├─ infrastructure/
│   └─ web/
│
├─ rulesets/
├─ samples/
├─ output/
│
└─ legacy/
    └─ csharp-engine/           ← Archived xBIM-based engine
```

---

## Status & Milestones

Active development.

- v0.4.0 — Static HTML QA report
- v0.5.0 — Interactive GLB viewer + UX improvement
- v0.6.0 — SQLite integration for shared multi-engine data layer

Scoped to demonstrate **AEC software engineering**, **BIM reasoning**,
and **production-quality tooling** without vendor lock-in.

Legacy C# / xBIM validation components are retained in the repository for historical reference during the migration to the Python-based engine.