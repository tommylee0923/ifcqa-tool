[![Python CI](https://github.com/tommylee0923/ifcqa-tool/actions/workflows/ifcqa.yml/badge.svg)](https://github.com/tommylee0923/ifcqa-tool/actions/workflows/ifcqa.yml)

# IfcQA — IFC Quality Gate for BIM Pipelines

![IfcQA HTML Report](docs/images/report-overview.png)

**IfcQA** is a lightweight IFC quality-gate and validation framework built primarily with Python and IfcOpenShell.
It validates BIM models against configurable JSON rulesets and generates structured QA outputs including JSON, CSV, and interactive 3D web reports served via a Flask API backed by PostgreSQL.

Live Interactive Demo: https://www.leetommy.com/ifcqa-tool/

---

## Key Features

### Rule-based IFC QA Engine
- Modular Python rule engine built on IfcOpenShell
- JSON-driven validation rulesets, persisted to PostgreSQL
- Extensible rule architecture (property, quantity, regex, comparison, and model traversal rules)
- Structured issue trace metadata (severity, path, expected, actual)

### Interactive, client-side QA dashboard
- React + TypeScript dashboard served by Flask
- IFC upload with drag-and-drop, ruleset selection, and GLB conversion
- Ruleset viewer for browsing rule details without opening JSON files
- Embedded Three.js GLB viewer with preserved GlobalId mapping
- Issue ↔ Element synchronization
- Hover highlight, click selection, and detail drawer interaction
- Draggable split-pane UI for review workflows

### CLI-First, Automation-Friendly
- Deterministic and reproducible output
- `--fail-on` threshold support for CI gating
- Designed for local QA, model audits, and pipeline integration

### PostgreSQL Integration
- Structured audit results, rulesets, and rule metadata written to PostgreSQL running in Docker
- Queryable issue history, audit runs, and ruleset library
- Shared persistence layer for CLI and web interface
- Supports downstream analytics and QA workflows

---

## Architecture

### Validation Engine
- Python
- IfcOpenShell
- JSON-driven modular rule system (22 rule types)

### IFC Processing
- IfcOpenShell
- IfcConvert (GLB export)

### Persistence Layer
- PostgreSQL
- Docker / Docker Compose
- Stores audit runs, issues, and rulesets

### Web Interface
- UI: React + TypeScript
- Viewer: Three.js
- Local API: Flask

### Outputs
- JSON
- CSV
- Interactive HTML QA reports

---
## Quickstart — Running with Docker

**Note:** Before building the Docker image, ensure `frontend/.env.production.local` exists with the following content:

```
VITE_API_MODE=flask
```
This is required for the React production build to connect to the Flask API.

### 1. Set up environment variables
Copy `.env.example` to `.env` and fill in your credentials.

### 2. Start the stack
```bash
docker compose up -d
```

### 3. Seed the database
```bash
docker exec -it ifcqa-auditor python app/main.py seed
```

### 4. Run an audit
```bash
docker exec -it ifcqa-auditor python app/main.py audit \
    samples/model.ifc \
    --ruleset rulesets/revit-export.json \
    --output output \
    --viewer
```

### 5. Query results
```bash
docker exec -it ifcqa-postgres psql -U ifcqa -d ifcqa -c "SELECT * FROM audit_runs;"
```

### 6. Open the app
```text
http://127.0.0.1:5000
```

## Quickstart - Running Locally

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

### 3. Seed the database

```bash
python auditor/app/main.py seed
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
cd frontend
npm install
npm run dev
```
Note: run `python auditor/app/server.py` in a separate terminal for the Flask API.

Then open:

```text
http://127.0.0.1:5000
```

From here, models can also be uploaded directly through the browser instead of the CLI — see [Browser Upload](#browser-upload).

### Outputs

The audit pipeline generates:

- `audit_report.json` — structured audit summary
- `issue.csv` — issue list export
- `model.glb` — viewer model asset (optional)
- Audit results are persisted to PostgreSQL

---

## PostgreSQL Integration

IfcQA writes structured audit results and rulesets into PostgreSQL running in Docker.

The database stores:

- audit run metadata
- issue records
- IFC class statistics
- validation trace data (`severity`, `path`, `expected`, `actual`)
- rulesets and individual rule definitions

This enables:

- persistent QA history
- issue querying and filtering
- a browsable, structured ruleset library
- downstream analytics workflows
- local web-based model review

The web interface reads directly from PostgreSQL and displays:

- issue summaries
- issue tables
- IFC class statistics
- interactive model viewer data
- ruleset and rule detail views

---

## CI Quality Gate (GitHub Actions)

This repo includes a GitHub Actions workflow that runs IfcQA against
a sample IFC on every push/PR.

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
│   └─ infrastructure/
│
├─ frontend/
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
- v0.7.0 - React + TypeSCript
- v0.8.0 - PostgreSQL migration + Docker containerization
- v0.9.0 - AWS EC2 deployment
- v1.0.0 — Browser-based IFC upload workflow with drag-and-drop UI
- v1.1.0 — PostgreSQL-backed ruleset manager and viewer

Scoped to demonstrate **AEC software engineering**, **BIM reasoning**,
and **production-quality tooling** without vendor lock-in.

Legacy C# / xBIM validation components are retained for historical reference.
