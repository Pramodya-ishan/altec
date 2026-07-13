import { getAdminDb, getAdminBucket } from "../firebase/admin";
import { 
  normalizeFileName, 
  SourceRecord, 
  SourceVisibility,
  MediaKind,
  ResourceRole,
  ProcessingStatus
} from "../../src/shared/source-registry";
import fs from "fs";
import path from "path";

export interface MigrationFinding {
  id: string;
  type: "duplicate_hash" | "missing_storage" | "invalid_owner" | "invalid_visibility" | "malformed_name" | "orphan_storage" | "stale_cache" | "other";
  severity: "low" | "medium" | "high" | "critical";
  collection: string;
  docId: string;
  details: string;
  proposedAction?: string;
}

export interface ScannerReport {
  summary: {
    totalScanned: number;
    totalFindings: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
  findings: MigrationFinding[];
  proposedMigrationPlan: Array<{
    legacyId: string;
    collection: string;
    action: "migrate" | "merge" | "skip" | "quarantine";
    reason: string;
    proposedSourceId?: string;
  }>;
}

export class MigrationScanner {
  private findings: MigrationFinding[] = [];
  private scannedCount = 0;
  private hashes = new Map<string, string[]>(); // hash -> [docIds]
  private migrationPlan: ScannerReport["proposedMigrationPlan"] = [];

  async scanCollection(collectionName: string, converter: (id: string, data: any) => Partial<SourceRecord>) {
    console.log(`Scanning collection: ${collectionName}...`);
    const db = getAdminDb();
    const bucket = getAdminBucket();
    const snapshot = await db.collection(collectionName).get();

    for (const doc of snapshot.docs) {
      this.scannedCount++;
      const data = doc.data();
      const id = doc.id;

      // 1. Owner & Visibility Checks
      const ownerUid = data.uploadedByUid || data.ownerUid;
      if (!ownerUid) {
        this.addFinding(collectionName, id, "invalid_owner", "high", "Missing owner UID");
      } else if (typeof ownerUid === "string" && ownerUid.includes("@")) {
        this.addFinding(collectionName, id, "invalid_owner", "medium", "Owner UID is an email address");
      }

      // 2. Storage Check
      const storagePath = data.url || data.storagePath;
      if (storagePath) {
        // Attempt to verify object exists if path is internal
        if (typeof storagePath === "string" && (storagePath.includes(bucket.name) || !storagePath.startsWith("http"))) {
          // Extract path from URL if needed or use direct path
          let cleanPath = storagePath;
          if (storagePath.startsWith("http")) {
             // simplified extraction for testing
             const match = storagePath.match(/o\/(.+?)\?/);
             if (match) cleanPath = decodeURIComponent(match[1]);
          }
          
          try {
            const file = bucket.file(cleanPath);
            const [exists] = await file.exists();
            if (!exists) {
              this.addFinding(collectionName, id, "missing_storage", "critical", `Storage object not found at path: ${cleanPath}`);
            }
          } catch (e) {
            this.addFinding(collectionName, id, "missing_storage", "medium", `Error checking storage: ${storagePath}`);
          }
        }
      } else {
        this.addFinding(collectionName, id, "missing_storage", "high", "No storage path found for source");
      }

      // 3. Hash Checks
      const hash = data.hash || data.sha256;
      if (hash && hash !== "legacy_pending" && hash !== "pending") {
        const existing = this.hashes.get(hash) || [];
        existing.push(`${collectionName}/${id}`);
        this.hashes.set(hash, existing);
        if (existing.length > 1) {
          this.addFinding(collectionName, id, "duplicate_hash", "medium", `Duplicate content hash detected: ${hash}. Shared with: ${existing.filter(i => i !== `${collectionName}/${id}`).join(", ")}`);
        }
      }

      // 4. Normalization Checks
      const fileName = data.fileName || data.name || data.title;
      if (fileName) {
        const norm = normalizeFileName(fileName);
        if (!norm.normalizedStem) {
          this.addFinding(collectionName, id, "malformed_name", "low", `Filename could not be properly normalized: ${fileName}`);
        }
      }

      // 5. Misnamed 'videos' array check
      if (data.videos && Array.isArray(data.videos)) {
        const hasNonVideo = data.videos.some((v: string) => !v.toLowerCase().endsWith(".mp4") && !v.toLowerCase().endsWith(".mov"));
        if (hasNonVideo) {
          this.addFinding(collectionName, id, "other", "medium", "Legacy 'videos' array contains non-video attachments (PDF/Images)");
        }
      }

      // Proposed Plan logic
      let action: "migrate" | "skip" | "quarantine" = "migrate";
      let reason = "Valid legacy record";
      
      if (!ownerUid || !storagePath) {
        action = "quarantine";
        reason = "Missing critical metadata (owner or storage)";
      } else if (this.findings.some(f => f.docId === id && f.severity === "critical")) {
        action = "skip";
        reason = "Critical findings detected";
      }

      this.migrationPlan.push({
        legacyId: id,
        collection: collectionName,
        action,
        reason,
        proposedSourceId: id // Default to existing ID for compatibility if safe
      });
    }
  }

  async scanIntegrity() {
    console.log("Scanning system integrity (orphans, cache, chunks)...");
    const db = getAdminDb();
    
    // Check Chunks without Source
    const chunkCollections = ["rag_chunks", "knowledge_chunks"];
    for (const coll of chunkCollections) {
      const snapshot = await db.collection(coll).get();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const sourceId = data.sourceId || data.parentSourceId;
        if (sourceId) {
          // Check if source exists in canonical OR legacy
          const sources = await db.collection("sources").doc(sourceId).get();
          const legacyRag = await db.collection("rag_sources").doc(sourceId).get();
          const legacyPp = await db.collection("past_papers").doc(sourceId).get();
          
          if (!sources.exists && !legacyRag.exists && !legacyPp.exists) {
            this.addFinding(coll, doc.id, "other", "high", `Orphaned chunk: Source ID ${sourceId} not found.`);
          }
        }
      }
    }

    // Check Stale Cache
    const cacheSnapshot = await db.collection("pdf_question_cache").get();
    for (const doc of cacheSnapshot.docs) {
      const data = doc.data();
      const sourceId = data.sourceId;
      if (sourceId) {
        const sources = await db.collection("sources").doc(sourceId).get();
        const legacyRag = await db.collection("rag_sources").doc(sourceId).get();
        const legacyPp = await db.collection("past_papers").doc(sourceId).get();
        if (!sources.exists && !legacyRag.exists && !legacyPp.exists) {
          this.addFinding("pdf_question_cache", doc.id, "stale_cache", "low", `Stale cache entry: Source ID ${sourceId} not found.`);
        }
      }
    }
  }

  async applyMigration(auth: { uid: string, roles: string[] }) {
    console.log("Applying migration to canonical Source Registry...");
    const db = getAdminDb();
    const report = this.generateReport();
    const runId = `MIG-${Date.now()}`;
    
    let migratedCount = 0;
    let skippedCount = 0;

    for (const plan of report.proposedMigrationPlan) {
      if (plan.action !== "migrate") {
        skippedCount++;
        continue;
      }

      // Check for existing canonical record
      const existing = await db.collection("sources").doc(plan.legacyId).get();
      if (existing.exists) {
        console.log(`Skipping ${plan.legacyId}: Canonical record already exists.`);
        skippedCount++;
        continue;
      }

      // Load legacy data
      const legacyDoc = await db.collection(plan.collection).doc(plan.legacyId).get();
      if (!legacyDoc.exists) {
        console.error(`Legacy document ${plan.legacyId} not found in ${plan.collection}`);
        continue;
      }

      const data = legacyDoc.data();
      const fileName = data.fileName || data.name || "unknown";
      const { normalizedName, normalizedStem } = normalizeFileName(fileName);
      
      // Map to canonical SourceRecord
      // In a real migration, we'd use the converter logic from Part 03B/C
      const sourceRecord: SourceRecord = {
        sourceId: plan.legacyId,
        ownerUid: data.uploadedByUid || data.ownerUid || "legacy_system",
        visibility: (data.isPublic ? "public" : (data.visibility || "private")) as SourceVisibility,
        displayTitle: data.name || data.fileName || data.title || "Untitled",
        originalFileName: fileName,
        normalizedName,
        normalizedStem,
        aliases: [],
        sha256: data.hash || data.sha256 || "legacy_pending",
        mimeType: "application/pdf",
        mediaKind: "pdf" as MediaKind,
        resourceRole: (plan.collection === "past_papers" ? "past_paper" : "student_note") as ResourceRole,
        sizeBytes: data.size || data.fileSize || 0,
        storagePath: data.url || data.storagePath || "",
        processingStatus: (data.status || "ready") as ProcessingStatus,
        chunkCount: 0,
        sourceVersion: 1,
        processingVersion: 1,
        notebookIds: [],
        createdAt: data.createdAt || Date.now(),
        updatedAt: Date.now(),
        migrationInfo: {
          runId,
          legacyId: plan.legacyId,
          legacyCollection: plan.collection,
          migratedAt: Date.now()
        }
      };

      try {
        await db.collection("sources").doc(plan.legacyId).set(sourceRecord);
        migratedCount++;
      } catch (err) {
        console.error(`Failed to migrate ${plan.legacyId}:`, err);
      }
    }

    console.log(`Migration Complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
    return { runId, migratedCount, skippedCount };
  }

  async rollbackMigration(runId: string) {
    console.log(`Rolling back migration run: ${runId}...`);
    const db = getAdminDb();
    const snapshot = await db.collection("sources").where("migrationInfo.runId", "==", runId).get();
    
    let rolledBackCount = 0;
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
      rolledBackCount++;
    }
    
    console.log(`Rollback Complete. Removed ${rolledBackCount} records.`);
    return { rolledBackCount };
  }

  private addFinding(collection: string, docId: string, type: MigrationFinding["type"], severity: MigrationFinding["severity"], details: string) {
    this.findings.push({
      id: `FIND-${this.findings.length + 1}`,
      type,
      severity,
      collection,
      docId,
      details,
      proposedAction: this.getProposedAction(type)
    });
  }

  private getProposedAction(type: MigrationFinding["type"]): string {
    switch (type) {
      case "duplicate_hash": return "Merge records or link to shared source record.";
      case "missing_storage": return "Investigate original storage or mark as source_missing.";
      case "invalid_owner": return "Assign authoritative owner or administrative UID.";
      case "malformed_name": return "Apply manual displayTitle or automated normalization.";
      default: return "Manual review required.";
    }
  }

  generateReport(): ScannerReport {
    const summary = {
      totalScanned: this.scannedCount,
      totalFindings: this.findings.length,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>
    };

    for (const f of this.findings) {
      summary.bySeverity[f.severity] = (summary.bySeverity[f.severity] || 0) + 1;
      summary.byType[f.type] = (summary.byType[f.type] || 0) + 1;
    }

    return {
      summary,
      findings: this.findings,
      proposedMigrationPlan: this.migrationPlan
    };
  }

  saveReport(filePath: string) {
    const report = this.generateReport();
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${filePath}`);
    
    // Also log summary to console
    console.log("\n--- MIGRATION SCAN SUMMARY ---");
    console.log(`Total Scanned: ${report.summary.totalScanned}`);
    console.log(`Total Findings: ${report.summary.totalFindings}`);
    console.log("By Severity:", report.summary.bySeverity);
    console.log("By Type:", report.summary.byType);
    console.log("-----------------------------\n");
  }
}
