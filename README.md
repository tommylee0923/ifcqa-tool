[![IFC QA](https://github.com/tommylee0923/ifc-quality-gate/actions/workflows/ifcqa.yml/badge.svg)](https://github.com/tommylee0923/ifc-quality-gate/actions/workflows/ifcqa.yml)

# IfcQA — IFC Quality Gate for BIM Pipelines

**IfcQA** is a lightweight, standards-oriented **IFC quality-gate CLI** built in **C# / .NET**, designed to evaluate BIM models against configurable QA rulesets and produce **human-readable, shareable reports**.

The tool aims to be intentionally **tool-agnostic** (no Revit dependency) and suitable for **local QA, CI pipelines, and downstream AEC automation workflows**.

---

## Why this exists

IFC (and BIM workflows more broadly) are often seen as complex and difficult to work with.

This project grew out of my own experience in AEC practice, such as many BIM quality issues come down to missing, inconsistent, or poorly structured data, yet diagnosing them usually requires opening specialized tools and digging through models manually.

IfcQA is as an attempt to make those issues easier to detect and explain by turning BIM model quality into clear, human-readable feedback.

---

## Key Features

### 1. Rule-based IFC QA Engine

- Modular C# rule system built on xBIM
- Operates on IFC semantics
- Supports property presence, consistency, naming, and containment rules
- Each rule emits structured issues with severity + trace metadata

---

### 2. JSON-Driven Rulesets (Standards-Oriented)

- Portable JSON rulesets
- Tool-agnostic baseline + Revit-export-aware pack
- Supports severity tuning, fallback logic, and noise suppression
- Mirrors how real BIM QA standards evolve

---

### 3. Zero-Backend HTML QA Report

- Single, zero-backend report.html
- Summary cards + filterable issue table
- Group-by-rule view with detailed issue drawer
- Rule metadata shown inline (why it matters, how to fix, etc.)

---

### 4. CLI-First, Automation-Friendly

- Deterministic output (JSON / CSV / HTML)
- Suitable for local QA, CI pipelines, and automation workflows

---

## Tech Stack
- **Language:** C# (.NET)
- **IFC Engine:** xBIM
- **Frontend:** Vanilla HTML / CSS / JS
- **Architecture:** CLI + static artifacts
- **Focus:** BIM data quality, IFC semantics, AEC automation

---

## Quickstart (Windows)

1)  Download the release zip and unzip
2)  In PowerShell:
```bash
.\ifcqa.exe init -o Demo
.\ifcqa.exe check path\to\model.ifc -o Demo\out -r Demo\rulesets\core\tool-agnostic-common.json
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

## Roadmap

### CI Example
- GitHub Actions workflow
- Run IfcQA on a sample IFC
- Fail build on errors
- Upload HTML report as an artifact

---

## Status

Active development.  
Scoped to demonstrate **AEC software engineering**, **BIM reasoning**, and **production-quality tooling** without vendor lock-in.
