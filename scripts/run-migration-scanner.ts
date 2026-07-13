import { MigrationScanner } from "../server/sources/migrationScanner";
import { SourceRecord, SourceVisibility, ProcessingStatus, MediaKind, ResourceRole } from "../src/shared/source-registry";
import path from "path";

async function run() {
  const scanner = new MigrationScanner();
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const rollbackRunId = args.find(a => a.startsWith("--rollback="))?.split("=")[1];

  if (rollbackRunId) {
    console.log(`Starting rollback for ${rollbackRunId}...`);
    await scanner.rollbackMigration(rollbackRunId);
    return;
  }

  // Define converters for legacy stores
  const ragConverter = (id: string, data: any): Partial<SourceRecord> => ({
    sourceId: id,
    displayTitle: data.name || data.fileName || "Untitled",
    ownerUid: data.uploadedByUid,
    visibility: (data.isPublic ? "public" : "private") as SourceVisibility,
    storagePath: data.url,
    processingStatus: (data.status || "ready") as ProcessingStatus,
    mediaKind: "pdf",
    resourceRole: "student_note"
  });

  const ppConverter = (id: string, data: any): Partial<SourceRecord> => ({
    sourceId: id,
    displayTitle: data.title || `${data.subject} ${data.year}`,
    ownerUid: data.ownerUid || "official_curriculum",
    visibility: "public",
    storagePath: data.storagePath || data.url,
    processingStatus: "ready",
    mediaKind: "pdf",
    resourceRole: "past_paper"
  });

  try {
    await scanner.scanCollection("rag_sources", ragConverter);
    await scanner.scanCollection("past_papers", ppConverter);
    await scanner.scanIntegrity();
    
    const reportPath = path.join(process.cwd(), "docs/migrations/reports/dry-run-report.json");
    scanner.saveReport(reportPath);

    if (isApply) {
      console.log("\n--- APPLYING MIGRATION ---");
      // Use system admin auth for migration
      const result = await scanner.applyMigration({ uid: "system-migrator", roles: ["admin"] });
      console.log(`Migration Applied: ${result.runId}`);
    } else {
      console.log("\nDry-run complete. Use --apply to perform migration.");
    }
    
    console.log("\n--- MIGRATION SCAN SUMMARY ---");
    const summary = scanner.generateReport().summary;
    console.log(`Total Scanned: ${summary.totalScanned}`);
    console.log(`Total Findings: ${summary.totalFindings}`);
    console.log(`By Severity:`, summary.bySeverity);
    console.log(`By Type:`, summary.byType);
    console.log("-----------------------------");
    console.log("Migration scan completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration scan failed:", err);
    process.exit(1);
  }
}

run();
