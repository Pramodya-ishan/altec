import { getAdminDb } from "../firebase/admin";
import { RagSource, RagChunk, RagJob } from "./types";

export async function saveRagSource(source: RagSource) {
  const db = getAdminDb();
  await db.collection("ragSources").doc(source.id).set(source, { merge: true });
}

export async function getRagSource(id: string): Promise<RagSource | null> {
  const db = getAdminDb();
  const doc = await db.collection("ragSources").doc(id).get();
  return doc.exists ? (doc.data() as RagSource) : null;
}

export async function saveRagChunk(chunk: RagChunk) {
  const db = getAdminDb();
  await db.collection("ragChunks").doc(chunk.id).set(chunk);
}

export async function saveRagJob(job: RagJob) {
  const db = getAdminDb();
  await db.collection("ragJobs").doc(job.id).set(job, { merge: true });
}

export async function getKnowledgeStats() {
  const db = getAdminDb();
  const stats = {
    sourcesCount: 0,
    chunksCount: 0,
    readySourcesCount: 0,
    failedJobsCount: 0,
    bySubject: { sft: 0, et: 0, ict: 0, general: 0 },
    lastUpdated: new Date().toISOString()
  };

  try {
    const sourcesSnap = await db.collection("ragSources").get();
    stats.sourcesCount = sourcesSnap.size;
    sourcesSnap.forEach((doc: any) => {
      const data = doc.data();
      if (data.status === "ready") stats.readySourcesCount++;
      if (data.subject && stats.bySubject.hasOwnProperty(data.subject)) {
        (stats.bySubject as any)[data.subject]++;
      }
    });

    // Approximate chunks count by reading sources chunkCount
    let totalChunks = 0;
    sourcesSnap.forEach((doc: any) => {
      totalChunks += doc.data().chunkCount || 0;
    });
    stats.chunksCount = totalChunks;

    const jobsSnap = await db.collection("ragJobs").where("status", "==", "failed").get();
    stats.failedJobsCount = jobsSnap.size;

  } catch (error) {
    console.error("Error getting RAG stats:", error);
  }

  return stats;
}
