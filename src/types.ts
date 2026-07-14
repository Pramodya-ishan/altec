export type LessonResourceKind = 'pdf' | 'image' | 'video' | 'audio' | 'document' | 'link';

export type LessonResourceStatus =
  | 'uploading'
  | 'uploaded'
  | 'queued'
  | 'transcoding'
  | 'transcribing'
  | 'indexing'
  | 'ready'
  | 'failed';

export type LessonResource = {
  id?: string;
  sourceId?: string;
  videoId?: string;
  url: string;
  title: string;
  type?: string;
  mimeType?: string;
  mediaKind?: LessonResourceKind;
  resourceRole?: 'video' | 'student_note' | 'image' | 'audio' | 'external_link';
  storagePath?: string;
  status?: LessonResourceStatus;
  thumbnailPath?: string;
  durationMs?: number;
  sizeBytes?: number;
  createdAt?: string;
};

export type Video = LessonResource;

export type TopicData = {
  checked: boolean;
  videos: Video[];
  resources?: LessonResource[];
  notes?: string; // Quick notes addition
};

export type PaperMark = {
  title: string;
  mcq: number;
  essay: number;
  total: number;
  grade: string;
  time: number;
  practical?: number;
};

export type QuestionMark = {
  title: string;
  time: number;
  year?: string;
  mcqRaw?: number | null;
  partARaw?: number | null;
  partBcdRaw?: number | null;
  // legacy support mapping
  mcqPer?: number;
  mcq?: number;
  partAPer?: number;
  pA?: number;
  partBcdPer?: number;
  essay?: number;
};

export type SubjectData = {
  topics: Record<string, TopicData>;
  paperMarks: PaperMark[];
  questionMarks: Record<string, QuestionMark[]>;
  lessonHistory?: { topic: string; done: boolean; date: string }[];
};

export type AppData = {
  sft: SubjectData;
  et: SubjectData;
  ict: SubjectData;
  zScoreHistory?: { 
    date: string; 
    zScore: number; 
    subjectZScores?: { sft: number; et: number; ict: number }; 
    rawPaperAverages?: { sft: number; et: number; ict: number };
    sampleCounts?: { sft: number; et: number; ict: number };
    calculationBasis?: "actual_saved_paper_marks";
    official?: false;
    fingerprint?: string;
    reason?: string; 
  }[];
  targetZ?: number;
  studyPlan?: string;
  collapsedStates?: Record<string, boolean>;
};

export type SubjectKey = 'sft' | 'et' | 'ict';
export type ViewKey = 'paper-structure' | 'paper-marks' | 'question-marks' | 'lesson-marks' | 'admission-predictor' | 'profile' | 'past-papers' | 'admin-dashboard' | 'focus-todo' | 'study-plan' | 'clora-x' | 'syllabus' | 'pdf-sources' | 'question-cache' | 'a3-war-room' | 'exam-intel' | 'prediction-papers' | 'mistake-notebook' | 'pdf-intel-admin';
export type ThemeKey = 'blue' | 'emerald' | 'slate';

export type SyllabusTopic = {
  q: string;
  title: string;
  count?: number; // for MCQ
  topics?: string[]; // for essay
  max?: number; // max marks for essay part
  subTitle?: string; // e.g. "ජීව විද්‍යාව"
};

export type ExamSection = {
  title: string;
  label: string;
  items: SyllabusTopic[];
  maxPerItem?: number;
};

export type SyllabusDef = {
  mcqMax: number;
  mcqMult: number; // For final calculation (e.g. 0.7 for ET)
  mcqItems: SyllabusTopic[];
  partAMax: number;
  partAItems: SyllabusTopic[];
  partBCDMax: number;
  partBCDItems: SyllabusTopic[];
  bcdGroups?: { title: string; label: string; items: SyllabusTopic[] }[]; // If grouped by parts
};

export interface RequirementQuestion {
  id: string;
  questionSi: string;
  questionEn?: string;
  type: "single_choice" | "multi_choice" | "boolean" | "number" | "time" | "date" | "text";
  options?: Array<{
    value: string;
    labelSi: string;
    labelEn?: string;
    description?: string;
  }>;
  required: boolean;
  whyNeeded: string;
  recommendedValue?: unknown;
}

export type StarItem = {
  id: number;
  x: number;
  y: number;
  size: number;
  driftX: number;
  driftY: number;
  duration: number;
  rotateDeg: number;
};

export interface AIChatMessage {
  id: string;
  sessionId?: string;
  sender: 'user' | 'assistant' | 'system';
  createdAt?: string;
  type?: 'text' | 'requirement_quiz';

  status?: 'waiting_for_requirements' | 'analysing' | 'writing' | 'streaming' | 'complete' | 'error' | 'idle';

  text?: string;
  body?: string; // body maps to text, but user prompt uses body for Markdown

  thinking?: {
    status: 'pending' | 'streaming' | 'complete' | 'error';
    summary: string;
    headline?: string;
    stages?: any[];
    warnings?: string[];
    assumptions?: string[];
    isExpanded: boolean;
    userCollapsed?: boolean;
  };

  error?: string;
  phase?: string;
  phaseMessage?: string;

  optimizedInstruction?: string;
  rawText?: string;

  requirementQuiz?: {
    questions: RequirementQuestion[];
    answers: Record<string, any>;
    isComplete: boolean;
  };
}
