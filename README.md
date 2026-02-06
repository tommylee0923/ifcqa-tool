[![IFC QA](https://github.com/tommylee0923/ifc-quality-gate/actions/workflows/ifcqa.yml/badge.svg)](https://github.com/tommylee0923/ifc-quality-gate/actions/workflows/ifcqa.yml)

# IfcQA — IFC Quality Gate for BIM Pipelines

![IfcQA HTML Report](docs/images/report-overview.png)

**IfcQA** is a lightweight, standards-oriented **IFC quality-gate CLI** built with **C# / .NET / xBIM toolkit**. It validates BIM models against configurable rulesets and produces clear, shareable QA reports for tool-agnostic workflows, CI pipelines, and automated AEC processes, to make BIM quality issues, such as inconsistent, poorly structured data, easier to detect and explain.

---

## Key Features

### 1. Rule-based IFC QA Engine

- Modular C# rule system built on xBIM
- Validates properties, naming, containment, and consistency
- Emits structured issues with severity + trace metadata

---

### 2. JSON-Driven Rulesets (Standards-Oriented)

- Portable, tool-agnostic JSON rulesets
- Supports severity tuning, fallback logic, and noise suppression

---

### 3. Zero-Backend HTML QA Report

- Single, static report.html
- Summary cards + filterable issue table

---

### 4. CLI-First, Automation-Friendly

- Deterministic output (JSON / CSV / HTML)
- Designed for local QA, CI pipelines, and automation workflows

---

## Tech Stack
- **Language:** C# (.NET)
- **IFC Toolkit:** xBIM
- **Frontend:** Vanilla HTML / CSS / JS

---

## Quickstart (Windows)

1)  Download and unzip the Windows release.
2)  Open PowerShell / Terminal in the extracted folder:
```bash
.\ifcqa.exe init -o Demo
.\ifcqa.exe check path\to\model.ifc -r Demo\rulesets\core\tool-agnostic-common.json -o Demo\out
```
3)  Open Demo\out\report.html

    Outputs:
    - `report.html`
    - `report.json`
    - optional CSV

---

## CI Quality Gate (GitHub Actions)

This repo includes a GitHub Actions workflow that runs IfcQA against a sample IFC on every push/PR and uploads the generated `report.html` as a build artifact.

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

## Status

Active development.  
Scoped to demonstrate **AEC software engineering**, **BIM reasoning**, and **production-quality tooling** without vendor lock-in.
