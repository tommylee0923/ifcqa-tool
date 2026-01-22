# IfcQA — IFC Quality Gate for BIM Pipelines

**IfcQA** is a lightweight, standards-oriented **IFC quality-gate CLI** built in **C# / .NET**, designed to evaluate BIM models against configurable QA rulesets and produce **human-readable, shareable reports**.

The tool aims to be intentionally **tool-agnostic** (no Revit dependency) and suitable for **local QA, CI pipelines, and downstream AEC automation workflows**.

---

## Why this exists

In many AEC pipelines, IFC validation is either:
- locked behind heavy BIM tools, or
- limited to schema-level checks with poor UX

IfcQA focuses on:
- **semantic model quality** (properties, consistency, naming, containment)
- **transparent rule logic**
- **outputs that non-BIM stakeholders can read and trust**
- **utilizes open-source XBim toolkit and IFC standards.**

This project was built to demonstrate **AEC software development, BIM data reasoning, and QA pipeline design**.

---

## Key Features

### 1. Rule-based IFC QA Engine
- Modular rule system implemented in C#
- Operates directly on IFC semantics via **xBIM**
- Rule types include:
  - Required / non-empty properties
  - Instance vs. type consistency
  - Allowed-value checks
  - Regex-based naming rules
  - Cross-property numeric comparisons
  - Spatial containment validation

Each rule emits structured issues with:
- severity (`Info`, `Warning`, `Error`)
- IFC class
- GlobalId
- human-readable message
- trace metadata (path, expected, actual, source)

---

### 2. JSON-Driven Rulesets (Standards-Oriented)
Rules are grouped into **portable JSON rulesets**, not hardcoded logic.

Current packs include:
- **Tool-agnostic baseline** (IFC-common checks)
- **Revit-export-aware ruleset** (accounts for exporter behavior without hard dependencies)

Rulesets support:
- rule metadata (title, why it matters, description)
- severity tuning
- fallback logic (instance OR type property)
- noise suppression (`skipIfMissing`)

This mirrors how real BIM QA standards evolve in practice.

---

### 3. Zero-Backend HTML QA Report (Milestone 3)
IfcQA generates a **single static `report.html`** alongside JSON/CSV output.

Report features:
- Summary cards (total / errors / warnings / info)
- Filterable issue table
- Group-by-rule view
- Click-through issue detail drawer
- Rule metadata panel
- Copyable GlobalIds for coordination

No backend, no build step — open in a browser and review.

---

### 4. CLI-First, Automation-Friendly
IfcQA is designed as a **quality gate**, not just an inspector.

- Deterministic output
- Machine-readable JSON payload
- Clean separation between:
  - core analysis
  - CLI orchestration
  - report generation

Suitable for local QA, CI pipelines, and downstream integrations.

---

## Example Usage

```bash
ifcqa check sample.ifc --rules rulesets/revit-export.json
```

Outputs:
- `report.html`
- `report.json`
- optional CSV

---

## Project Structure

```
src/
 ├─ IfcQa.Core
 │   ├─ Rules/
 │   ├─ Issue + trace extensions
 │   └─ IFC utilities
 │
 ├─ IfcQa.Cli
 │   ├─ Program.cs
 │   ├─ HtmlReportWriter.cs
 │   └─ ReportTemplates/
 │       ├─ report.template.html
 │       ├─ report.css
 │       └─ report.js
 │
 └─ rulesets/
     ├─ tool-agnostic-common.json
     └─ revit-export.json
```

---

## Roadmap

### One-click distribution
- Package as a single executable (`dotnet publish`)
- Include default rulesets in build output
- `--init` command to scaffold a starter QA project

### CI Example
- GitHub Actions workflow
- Run IfcQA on a sample IFC
- Fail build on errors
- Upload HTML report as an artifact

---

## Tech Stack
- **Language:** C# (.NET)
- **IFC Engine:** xBIM
- **Frontend:** Vanilla HTML / CSS / JS
- **Architecture:** CLI + static artifacts
- **Focus:** BIM data quality, IFC semantics, AEC automation

---

## Status

Active development.  
Scoped to demonstrate **AEC software engineering**, **BIM reasoning**, and **production-quality tooling** without vendor lock-in.
