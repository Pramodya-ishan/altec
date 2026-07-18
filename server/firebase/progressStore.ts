import crypto from "node:crypto";
import {
  PROGRESS_SCHEMA_VERSION,
  PROGRESS_SUBJECTS,
  combineProgressSections,
  hasMeaningfulProgress,
  normalizeProgressData,
  splitProgressData,
  type ProgressSections,
} from "../../src/shared/progressData";
import { getAdminDb } from "./admin";

export type ProgressReadResult = {
  data: ReturnType<typeof normalizeProgressData>;
  source: "sectioned_v2" | "uid_progress_data" | "uid_root" | "email_progress_data" | "email_root" | "empty";
  revision: string | null;
  updatedAt: string | null;
  migrated: boolean;
};

function userRef(uid: string) {
  return getAdminDb().collection("users").doc(uid);
}

function sectionRefs(uid: string) {
  const collection = userRef(uid).collection("progress_sections");
  return {
    sft: collection.doc("sft"),
    et: collection.doc("et"),
    ict: collection.doc("ict"),
    meta: collection.doc("meta"),
  };
}

function extractLegacyData(snapshot: any) {
  if (!snapshot?.exists) return null;
  const raw = snapshot.data() || {};
  const candidate = raw.data || raw.appData || null;
  return hasMeaningfulProgress(candidate) ? normalizeProgressData(candidate) : null;
}

export async function readProgressData(uid: string, email?: string): Promise<ProgressReadResult> {
  const db = getAdminDb();
  const refs = sectionRefs(uid);
  const [sftSnap, etSnap, ictSnap, metaSnap] = await db.getAll(refs.sft, refs.et, refs.ict, refs.meta);
  const hasV2 = [sftSnap, etSnap, ictSnap, metaSnap].some((snapshot: any) => snapshot.exists);
  const hasCompleteV2 = [sftSnap, etSnap, ictSnap].every((snapshot: any) => snapshot.exists);
  const metaRaw = metaSnap.exists ? metaSnap.data() || {} : {};
  const v2Sections: Partial<ProgressSections> = {
    sft: sftSnap.exists ? (sftSnap.data()?.data || sftSnap.data()) : undefined,
    et: etSnap.exists ? (etSnap.data()?.data || etSnap.data()) : undefined,
    ict: ictSnap.exists ? (ictSnap.data()?.data || ictSnap.data()) : undefined,
    meta: metaRaw.data || {},
  };

  if (hasCompleteV2) {
    return {
      data: combineProgressSections(v2Sections),
      source: "sectioned_v2",
      revision: typeof metaRaw.revision === "string" ? metaRaw.revision : null,
      updatedAt: typeof metaRaw.updatedAt === "string" ? metaRaw.updatedAt : null,
      migrated: false,
    };
  }

  const uidRoot = userRef(uid);
  const uidProgress = uidRoot.collection("progress").doc("data");
  const [uidProgressSnap, uidRootSnap] = await db.getAll(uidProgress, uidRoot);
  let legacy = extractLegacyData(uidProgressSnap);
  let source: ProgressReadResult["source"] = "uid_progress_data";

  if (!legacy) {
    legacy = extractLegacyData(uidRootSnap);
    source = "uid_root";
  }

  if (!legacy && email) {
    const normalizedEmail = email.trim().toLowerCase();
    const emailRoot = db.collection("users").doc(normalizedEmail);
    const [emailProgressSnap, emailRootSnap] = await db.getAll(
      emailRoot.collection("progress").doc("data"),
      emailRoot,
    );
    legacy = extractLegacyData(emailProgressSnap);
    source = "email_progress_data";
    if (!legacy) {
      legacy = extractLegacyData(emailRootSnap);
      source = "email_root";
    }
  }

  if (legacy) {
    // A target-Z update may have created only the V2 meta section. Preserve any
    // already-written V2 subject section and fill missing sections from legacy.
    const merged = hasV2
      ? normalizeProgressData({
          ...legacy,
          ...(v2Sections.meta || {}),
          sft: v2Sections.sft || legacy.sft,
          et: v2Sections.et || legacy.et,
          ict: v2Sections.ict || legacy.ict,
        })
      : legacy;
    const writeResult = await writeProgressData(uid, email, merged, { migration: true });
    return {
      data: merged,
      source,
      revision: writeResult.revision,
      updatedAt: writeResult.updatedAt,
      migrated: true,
    };
  }

  if (hasV2) {
    return {
      data: combineProgressSections(v2Sections),
      source: "sectioned_v2",
      revision: typeof metaRaw.revision === "string" ? metaRaw.revision : null,
      updatedAt: typeof metaRaw.updatedAt === "string" ? metaRaw.updatedAt : null,
      migrated: false,
    };
  }

  return {
    data: normalizeProgressData(null),
    source: "empty",
    revision: null,
    updatedAt: null,
    migrated: false,
  };
}

export async function writeProgressData(
  uid: string,
  email: string | undefined,
  value: unknown,
  options: { migration?: boolean } = {},
) {
  const db = getAdminDb();
  const normalized = normalizeProgressData(value);
  const sections = splitProgressData(normalized);
  const refs = sectionRefs(uid);
  const updatedAt = new Date().toISOString();
  const revision = crypto.randomUUID();
  const batch = db.batch();
  const common = {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    revision,
    updatedAt,
  };

  for (const subject of PROGRESS_SUBJECTS) {
    batch.set(refs[subject], {
      ...common,
      subject,
      data: sections[subject],
    }, { merge: false });
  }

  batch.set(refs.meta, {
    ...common,
    email: email?.trim().toLowerCase() || "",
    data: sections.meta,
  }, { merge: false });

  // Keep only a lightweight compatibility marker. Rewriting the complete app
  // data into one Firestore document caused the previous 1 MiB failures.
  batch.set(userRef(uid).collection("progress").doc("data"), {
    ...common,
    sectioned: true,
    email: email?.trim().toLowerCase() || "",
    targetZScore: normalized.targetZ ?? null,
    historyCount: normalized.zScoreHistory?.length || 0,
  }, { merge: true });
  batch.set(userRef(uid), {
    progressSchemaVersion: PROGRESS_SCHEMA_VERSION,
    progressRevision: revision,
    progressUpdatedAt: updatedAt,
  }, { merge: true });

  await batch.commit();
  return {
    revision,
    updatedAt,
    migrated: options.migration === true,
  };
}

export async function patchProgressMeta(uid: string, patch: Record<string, unknown>) {
  const refs = sectionRefs(uid);
  const current = await refs.meta.get();
  const raw = current.exists ? current.data() || {} : {};
  const currentData = raw.data && typeof raw.data === "object" ? raw.data : {};
  const updatedAt = new Date().toISOString();
  const revision = crypto.randomUUID();
  await refs.meta.set({
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    revision,
    updatedAt,
    data: { ...currentData, ...patch },
  }, { merge: true });
  return { revision, updatedAt };
}

export function summarizeProgressForAudit(value: unknown) {
  const data = normalizeProgressData(value);
  return {
    subjects: Object.fromEntries(PROGRESS_SUBJECTS.map((subject) => [subject, {
      topicCount: Object.keys(data[subject].topics || {}).length,
      paperMarkCount: data[subject].paperMarks.length,
      questionGroupCount: Object.keys(data[subject].questionMarks || {}).length,
    }])),
    zScoreHistoryCount: data.zScoreHistory?.length || 0,
    hasTargetZ: Number.isFinite(Number(data.targetZ)),
  };
}
