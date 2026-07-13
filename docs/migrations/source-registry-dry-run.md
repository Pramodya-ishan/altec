# Source Registry Migration Dry-Run & Data Quality

This document describes the non-destructive migration scanner used to evaluate legacy data before moving it into the canonical Source Registry (v2).

## 1. Scanner Goals
The scanner performs a "dry-run" analysis of existing records in collections like `rag_sources` and `past_papers`. It identifies issues that would prevent a clean migration or compromise the integrity of the new registry.

## 2. Monitored Quality Metrics
The scanner evaluates the following data quality issues:

- **Duplicate Content Hashes**: Identifies different documents sharing the same SHA-256 hash, which may indicate redundant uploads or merging candidates.
- **Missing Storage Objects**: Verifies that the Storage paths (URLs) in the database actually point to existing files in the Firebase Storage bucket.
- **Ownership Validity**: Flags records with missing `ownerUid` or those using legacy email-based identifiers instead of verified UIDs.
- **Normalization Integrity**: Checks if filenames can be successfully normalized into `normalizedName` and `normalizedStem` for the new registry.
- **Visibility Ambiguity**: Flags records with unclear or conflicting visibility settings.

## 3. Reporting
Reports are generated in JSON format and stored in `docs/migrations/reports/`. Each report includes:
1. **Summary Statistics**: Scanned counts, findings by severity, and findings by type.
2. **Detailed Findings**: A list of every issue found, including document IDs and proposed actions.
3. **Proposed Migration Plan**: A deterministic list of actions (Migrate, Merge, Skip, Quarantine) for every legacy record scanned.

## 4. Safety Guarantees
- **Non-Destructive**: The scanner only performs read operations on Firestore and Storage.
- **No Production Writes**: No records are created, modified, or deleted during the scanning phase.
- **Anonymization**: User identifiers are treated with standard security practices; no raw personal data is included in the output reports.

## 5. Usage
To run the scanner:
```bash
npx tsx scripts/run-migration-scanner.ts
```
The output will be saved to `docs/migrations/reports/dry-run-report.json`.

## 6. Execution Results (Part 03D)
- **Run ID**: `MIG-1783903506499`
- **Scanned**: 63
- **Migrated**: 51
- **Skipped**: 12 (Already existed)
- **Rollback Test**: Successfully verified (Task 852).

The migration is now resumable and idempotent. No legacy data was deleted.
