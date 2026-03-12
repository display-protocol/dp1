# AI Agent Guidelines for DP-1 Protocol Specification

This document provides guidelines for AI agents (assistants, copilots, and other LLMs) working on the DP-1 Protocol Specification repository.

## Overview

This repository contains the DP-1 protocol specification, including:
- Markdown documentation files (`.md`)
- JSON Schema files (`.json`)
- GitHub Actions CI/CD workflows

## Required Validation After Changes

When you make changes to files in this repository, you **MUST** run appropriate validation checks before completing your task.

### 1. Markdown File Changes

**When to validate**: After editing any `.md` file (specifications, documentation, READMEs)

**Command to run**:
```bash
npx markdownlint '**/*.md' --ignore node_modules
```

**Success criteria**:
- Exit code 0 = All checks pass ✓
- Exit code 1 = Linting errors found ✗

**If validation fails**:
1. Review the error output (format: `file:line:column error-code/rule-name Description`)
2. Fix the reported issues
3. Re-run the validation to confirm fixes
4. Do not complete the task until validation passes

**Common issues and fixes**:
- **MD009 (trailing spaces)**: Remove whitespace characters at the end of lines
- **MD056 (table column count)**: Ensure all table rows have the correct number of columns matching the header

**Configuration**: See `.markdownlint.json` for enabled/disabled rules

### 2. JSON File Changes

**When to validate**: After editing any `.json` file (schemas, configuration files, data files)

**Commands to run**:

For JSON syntax validation (all JSON files):
```bash
for json in $(find . -name "*.json" -not -path "./node_modules/*"); do
  jq empty "$json" || exit 1
done
```

For JSON Schema validation (schema files only):
```bash
find . -type f \( -path "*/schemas/*.json" -o -name "*schema.json" \) -not -path "./node_modules/*" | while read schema; do
  ajv compile -s "$schema" --spec=draft2020 -c ajv-formats
done
```

**Success criteria**:
- No output or "valid" message = All checks pass ✓
- Parse error or compilation error = Validation failed ✗

**If validation fails**:
1. Review the error output
2. Fix JSON syntax errors (missing commas, brackets, quotes) or schema structure issues
3. Re-run the validation to confirm fixes
4. Do not complete the task until validation passes

### 3. Dependencies Required

Ensure these tools are installed before running validations:
```bash
npm install --save-dev markdownlint-cli ajv-cli ajv-formats
```

## CI/CD Integration

This repository uses GitHub Actions for continuous integration. The same validation checks run automatically on:
- Pull requests to the `main` branch
- Direct pushes to the `main` branch

**Why local validation matters**:
- Prevents CI pipeline failures
- Provides faster feedback
- Maintains consistent code quality
- Reduces review cycle time

## Workflow File Structure

```
.github/workflows/
  └── lint.yaml          # CI workflow for linting

.markdownlint.json       # Markdown linting configuration
.cursor/rules/           # Cursor-specific rules (optional)
  └── lint-validation.mdc
```

## Example: Complete Validation Workflow

```bash
# Step 1: Make your changes
# (edit markdown or JSON files)

# Step 2: Run appropriate validation
npx markdownlint '**/*.md' --ignore node_modules

# Step 3: Check the output
# - Exit code 0? Continue to next step
# - Exit code 1? Fix errors and re-run

# Step 4: For JSON changes, validate syntax
for json in $(find . -name "*.json" -not -path "./node_modules/*"); do
  jq empty "$json" || exit 1
done

# Step 5: Only complete task when all validations pass
```

## Project-Specific Guidelines

### File Organization

- **Core specifications**: `core/v{version}/spec.md`
- **JSON Schemas**: `core/v{version}/schemas/*.json`
- **Extensions**: `extensions/{extension-name}/`
- **Documentation**: Root-level `README.md`

### Naming Conventions

- Schema files should be in a `schemas/` folder OR end with `schema.json`
- Version folders follow semantic versioning: `v{major}.{minor}.{patch}`
- Extension schemas use the pattern: `extensions/{name}/schema.json`

### Critical Rules

1. **Always validate before completing tasks**
2. **Never commit files with linting errors**
3. **Test changes locally using `act` if modifying workflows**
4. **Maintain consistency with existing file structure**
5. **Preserve markdown formatting and table structures**

## Testing GitHub Actions Locally

If you modify `.github/workflows/lint.yaml`, test it locally using `act`:

```bash
# Test markdown linting job
act push --container-architecture linux/amd64 -j lint-markdown

# Test JSON validation job
act push --container-architecture linux/amd64 -j lint-json-schema

# Test both jobs
act push --container-architecture linux/amd64
```

## Questions or Issues?

- Review the CI workflow: `.github/workflows/lint.yaml`
- Check linting configuration: `.markdownlint.json`
- Examine existing files for examples
- Refer to the main README.md for project context

---

**Last Updated**: 2026-03-12  
**Applies to**: All AI agents working on this repository  
**Enforcement**: Required for all file modifications
