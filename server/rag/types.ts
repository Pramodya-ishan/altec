export type Subject = "sft" | "et" | "ict" | "general";
export type SourceType = "syllabus" | "past_paper" | "marking_scheme" | "note" | "paper_structure" | "question_bank";

export interface RagSource {
  id: string;
  subject: Subject;
  sourceType: SourceType;
  year?: number;
  title: string;
  fileName: string;
  storagePath?: string;
  publicUrl?: string;
  uploadedByUid: string;
  uploadedByEmail: string;
  status: "processing" | "ready" | "failed";
  pageCount?: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface RagChunk {
  id: string;
  sourceId: string;
  subject: Subject;
  sourceType: SourceType;
  year?: number;
  pageStart?: number;
  pageEnd?: number;
  lesson?: string;
  subtopic?: string;
  text: string;
  normalizedText: string;
  keywords: string[];
  embedding?: number[];
  tokenEstimate: number;
  createdAt: string;
}

export interface RagJob {
  id: string;
  sourceId: string;
  status: "pending" | "running" | "completed" | "failed";
  step: string;
  progress: number;
  logs: string[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}
