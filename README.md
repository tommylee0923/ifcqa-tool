[![Python CI](https://github.com/tommylee0923/ifcqa-tool/actions/workflows/ifcqa.yml/badge.svg)](https://github.com/tommylee0923/ifcqa-tool/actions/workflows/ifcqa.yml)

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

## Quickstart

### 1. Clone the repository

```bash
git clone https://github.com/tommylee0923/ifc-quality-gate.git
cd ifc-quality-gate
```

### 2. Create a Python virtual environment

```bash
python -m venv .venv
pip install -r auditor/requirements.txt
```

Activate it:

#### Windows

```powershell
.venv\Scripts\activate
```

#### macOS / Linux

```bash
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run an IFC audit

```powershell
python auditor/app/main.py audit samples/model.ifc ^
    --ruleset rulesets/revit-export.json ^
    --output output
```

### 5. Generate GLB viewer assets (optional)

```powershell
python auditor/app/main.py audit samples/model.ifc ^
    --ruleset rulesets/revit-export.json ^
    --output output ^
    --viewer
```

### 6. Launch the local web interface

```powershell
python auditor/app/server.py
```

Then open:

```text
http://127.0.0.1:5000
```

### Outputs

The audit pipeline generates:

- `audit_report.json` — structured audit summary
- `issues.csv` — issue list export
- `audit.db` — SQLite database
- `model.glb` — viewer model asset (optional)
- `viewer/` — Three.js viewer assets

---

## SQLite Integration

IfcQA writes structured audit results into a local SQLite database (`audit.db`).

The database stores:

- audit run metadata
- issue records
- IFC class statistics
- validation trace data (`severity`, `path`, `expected`, `actual`)

This enables:

- persistent QA history
- issue querying and filtering
- downstream analytics workflows
- local web-based model review

---

### Example

Run an audit and write results into SQLite:

```powershell
python auditor/app/main.py audit samples/model.ifc ^
    --ruleset rulesets/revit-export.json ^
    --output output
```

Launch the local web interface:

```powershell
python auditor/app/server.py
```

Then open:

```text
http://127.0.0.1:5000
```

The web interface reads directly from `audit.db` and displays:

- issue summaries
- issue tables
- IFC class statistics
- interactive model viewer data
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
