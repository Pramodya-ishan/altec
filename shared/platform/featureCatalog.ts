export type FeatureCategory =
  | "ai_learning"
  | "auth_data"
  | "performance_reliability"
  | "ui_ux"
  | "files_media"
  | "security_quality";

export type FeatureDeliveryState = "available" | "foundation" | "planned";
export type FeaturePriority = "high" | "medium" | "normal";

export interface PlatformFeature {
  id: number;
  key: string;
  category: FeatureCategory;
  title: string;
  state: FeatureDeliveryState;
  priority: FeaturePriority;
  defaultEnabled: boolean;
  implementationRefs: string[];
}

export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  ai_learning: "AI සහ learning",
  auth_data: "Authentication, data සහ profiles",
  performance_reliability: "Performance සහ reliability",
  ui_ux: "UI/UX සහ responsive design",
  files_media: "Files, PDFs සහ video",
  security_quality: "Security, DevOps, SEO සහ quality",
};

export const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    "id": 1,
    "category": "ai_learning",
    "title": "PDF එකේ Q1, Q2 වගේ question-number lookup.",
    "key": "feature_001",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 2,
    "category": "ai_learning",
    "title": "Previous message එකේ selected PDF එක conversation memory එකේ තබාගැනීම.",
    "key": "feature_002",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 3,
    "category": "ai_learning",
    "title": "Lesson name Sinhala/English/Singlish වලින් resolve කිරීම.",
    "key": "feature_003",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 4,
    "category": "ai_learning",
    "title": "“තරල”, “tharala”, “fluids” එකම lesson එකක් ලෙස හඳුනාගැනීම.",
    "key": "feature_004",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 5,
    "category": "ai_learning",
    "title": "Uploaded PDFs සියල්ල automatic indexing කිරීම.",
    "key": "feature_005",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 6,
    "category": "ai_learning",
    "title": "Indexing status එක real time පෙන්වීම.",
    "key": "feature_006",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 7,
    "category": "ai_learning",
    "title": "Failed indexing සඳහා automatic retry.",
    "key": "feature_007",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 8,
    "category": "ai_learning",
    "title": "Scanned PDFs සඳහා OCR fallback.",
    "key": "feature_008",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 9,
    "category": "ai_learning",
    "title": "Sinhala OCR confidence scoring.",
    "key": "feature_009",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 10,
    "category": "ai_learning",
    "title": "Low-confidence OCR text user review කිරීමට ලබාදීම.",
    "key": "feature_010",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 11,
    "category": "ai_learning",
    "title": "PDF page-number citations.",
    "key": "feature_011",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 12,
    "category": "ai_learning",
    "title": "Answer එක සමඟ source page preview.",
    "key": "feature_012",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 13,
    "category": "ai_learning",
    "title": "Exact source quote highlighting.",
    "key": "feature_013",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 14,
    "category": "ai_learning",
    "title": "Fabricated questions සහ answers අවහිර කිරීම.",
    "key": "feature_014",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 15,
    "category": "ai_learning",
    "title": "Source එකේ නැති facts දෙන විට clear warning.",
    "key": "feature_015",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 16,
    "category": "ai_learning",
    "title": "Answer confidence indicator.",
    "key": "feature_016",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 17,
    "category": "ai_learning",
    "title": "Multiple PDFs එකවර search කිරීම.",
    "key": "feature_017",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 18,
    "category": "ai_learning",
    "title": "Lesson container එකේ සියලු resources combine කිරීම.",
    "key": "feature_018",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 19,
    "category": "ai_learning",
    "title": "Past paper සහ marking scheme automatically pair කිරීම.",
    "key": "feature_019",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 20,
    "category": "ai_learning",
    "title": "Question paper year/type detection.",
    "key": "feature_020",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 21,
    "category": "ai_learning",
    "title": "MCQ/Structured/Essay automatic classification.",
    "key": "feature_021",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 22,
    "category": "ai_learning",
    "title": "Question number extraction.",
    "key": "feature_022",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 23,
    "category": "ai_learning",
    "title": "Marking scheme answer extraction.",
    "key": "feature_023",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 24,
    "category": "ai_learning",
    "title": "Diagram-based question detection.",
    "key": "feature_024",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 25,
    "category": "ai_learning",
    "title": "Table extraction.",
    "key": "feature_025",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 26,
    "category": "ai_learning",
    "title": "Equation extraction.",
    "key": "feature_026",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 27,
    "category": "ai_learning",
    "title": "Sinhala mathematical text normalization.",
    "key": "feature_027",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 28,
    "category": "ai_learning",
    "title": "Image-only page understanding.",
    "key": "feature_028",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 29,
    "category": "ai_learning",
    "title": "PDF duplicate detection.",
    "key": "feature_029",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 30,
    "category": "ai_learning",
    "title": "Bad/corrupt PDF detection.",
    "key": "feature_030",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 31,
    "category": "ai_learning",
    "title": "Indexed text completeness report.",
    "key": "feature_031",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 32,
    "category": "ai_learning",
    "title": "PDF page rotation correction.",
    "key": "feature_032",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 33,
    "category": "ai_learning",
    "title": "Handwritten note OCR.",
    "key": "feature_033",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 34,
    "category": "ai_learning",
    "title": "Mixed Sinhala-English OCR.",
    "key": "feature_034",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 35,
    "category": "ai_learning",
    "title": "Resource title automatic cleanup.",
    "key": "feature_035",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 36,
    "category": "ai_learning",
    "title": "File name වෙනුවට lesson-friendly title generation.",
    "key": "feature_036",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 37,
    "category": "ai_learning",
    "title": "Teacher name extraction.",
    "key": "feature_037",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 38,
    "category": "ai_learning",
    "title": "Exam year extraction.",
    "key": "feature_038",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 39,
    "category": "ai_learning",
    "title": "Subject detection: SFT/ET/ICT.",
    "key": "feature_039",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 40,
    "category": "ai_learning",
    "title": "Medium detection: Sinhala/English.",
    "key": "feature_040",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 41,
    "category": "ai_learning",
    "title": "Paper vs marking scheme detection.",
    "key": "feature_041",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 42,
    "category": "ai_learning",
    "title": "Lesson-level semantic search.",
    "key": "feature_042",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 43,
    "category": "ai_learning",
    "title": "Keyword search fallback.",
    "key": "feature_043",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 44,
    "category": "ai_learning",
    "title": "Exact phrase search.",
    "key": "feature_044",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 45,
    "category": "ai_learning",
    "title": "Source relevance ranking.",
    "key": "feature_045",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 46,
    "category": "ai_learning",
    "title": "Outdated source warning.",
    "key": "feature_046",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 47,
    "category": "ai_learning",
    "title": "Duplicate source merging.",
    "key": "feature_047",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 48,
    "category": "ai_learning",
    "title": "Admin source verification.",
    "key": "feature_048",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 49,
    "category": "ai_learning",
    "title": "Trusted-source badges.",
    "key": "feature_049",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 50,
    "category": "ai_learning",
    "title": "AI answer audit trail.",
    "key": "feature_050",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 51,
    "category": "ai_learning",
    "title": "Student weak-lesson detection.",
    "key": "feature_051",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 52,
    "category": "ai_learning",
    "title": "Mastered-lesson detection.",
    "key": "feature_052",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 53,
    "category": "ai_learning",
    "title": "Personalized revision plan.",
    "key": "feature_053",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 54,
    "category": "ai_learning",
    "title": "Daily lesson recommendation.",
    "key": "feature_054",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 55,
    "category": "ai_learning",
    "title": "Upcoming exam countdown plan.",
    "key": "feature_055",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 56,
    "category": "ai_learning",
    "title": "Student marks-based difficulty adjustment.",
    "key": "feature_056",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 57,
    "category": "ai_learning",
    "title": "Beginner/intermediate/advanced answer modes.",
    "key": "feature_057",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 58,
    "category": "ai_learning",
    "title": "Short/normal/detailed answer length controls.",
    "key": "feature_058",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 59,
    "category": "ai_learning",
    "title": "Sinhala/English/Singlish response selector.",
    "key": "feature_059",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 60,
    "category": "ai_learning",
    "title": "Teacher-style explanation selector.",
    "key": "feature_060",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 61,
    "category": "ai_learning",
    "title": "Step-by-step calculation mode.",
    "key": "feature_061",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 62,
    "category": "ai_learning",
    "title": "Hint-only mode.",
    "key": "feature_062",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 63,
    "category": "ai_learning",
    "title": "Socratic tutoring mode.",
    "key": "feature_063",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 64,
    "category": "ai_learning",
    "title": "“Don’t reveal answer yet” mode.",
    "key": "feature_064",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 65,
    "category": "ai_learning",
    "title": "Formula-first explanation.",
    "key": "feature_065",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 66,
    "category": "ai_learning",
    "title": "Diagram-first explanation.",
    "key": "feature_066",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 67,
    "category": "ai_learning",
    "title": "Example-first explanation.",
    "key": "feature_067",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 68,
    "category": "ai_learning",
    "title": "Common-mistake explanation.",
    "key": "feature_068",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 69,
    "category": "ai_learning",
    "title": "Exam marking-point explanation.",
    "key": "feature_069",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 70,
    "category": "ai_learning",
    "title": "Time-saving exam technique suggestions.",
    "key": "feature_070",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 71,
    "category": "ai_learning",
    "title": "Student’s previous mistakes automatically use කිරීම.",
    "key": "feature_071",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 72,
    "category": "ai_learning",
    "title": "Similar past-paper question recommendation.",
    "key": "feature_072",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 73,
    "category": "ai_learning",
    "title": "Spaced-repetition scheduling.",
    "key": "feature_073",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 74,
    "category": "ai_learning",
    "title": "Forgotten-topic reminders.",
    "key": "feature_074",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 75,
    "category": "ai_learning",
    "title": "Daily five-question quiz.",
    "key": "feature_075",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 76,
    "category": "ai_learning",
    "title": "Weekly progress quiz.",
    "key": "feature_076",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 77,
    "category": "ai_learning",
    "title": "Lesson completion quiz.",
    "key": "feature_077",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 78,
    "category": "ai_learning",
    "title": "Adaptive question difficulty.",
    "key": "feature_078",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 79,
    "category": "ai_learning",
    "title": "Wrong answer follow-up question.",
    "key": "feature_079",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 80,
    "category": "ai_learning",
    "title": "Correct answer deeper challenge.",
    "key": "feature_080",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 81,
    "category": "ai_learning",
    "title": "Student confidence input.",
    "key": "feature_081",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 82,
    "category": "ai_learning",
    "title": "Guessing detection.",
    "key": "feature_082",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 83,
    "category": "ai_learning",
    "title": "Concept misconception detection.",
    "key": "feature_083",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 84,
    "category": "ai_learning",
    "title": "Formula misuse detection.",
    "key": "feature_084",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 85,
    "category": "ai_learning",
    "title": "Unit-conversion mistake detection.",
    "key": "feature_085",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 86,
    "category": "ai_learning",
    "title": "Calculation-step validation.",
    "key": "feature_086",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 87,
    "category": "ai_learning",
    "title": "Answer structure feedback.",
    "key": "feature_087",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 88,
    "category": "ai_learning",
    "title": "Essay paragraph feedback.",
    "key": "feature_088",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 89,
    "category": "ai_learning",
    "title": "Mark allocation prediction.",
    "key": "feature_089",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 90,
    "category": "ai_learning",
    "title": "Estimated score per response.",
    "key": "feature_090",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 91,
    "category": "ai_learning",
    "title": "PDF එකෙන් exact quiz generation.",
    "key": "feature_091",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 92,
    "category": "ai_learning",
    "title": "Marking scheme grounded quiz evaluation.",
    "key": "feature_092",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 93,
    "category": "ai_learning",
    "title": "MCQ distractor explanations.",
    "key": "feature_093",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 94,
    "category": "ai_learning",
    "title": "Timed MCQ mode.",
    "key": "feature_094",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 95,
    "category": "ai_learning",
    "title": "Structured essay practice mode.",
    "key": "feature_095",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 96,
    "category": "ai_learning",
    "title": "Full-paper simulation.",
    "key": "feature_096",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 97,
    "category": "ai_learning",
    "title": "Automatic paper timer.",
    "key": "feature_097",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 98,
    "category": "ai_learning",
    "title": "Section-specific timer.",
    "key": "feature_098",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 99,
    "category": "ai_learning",
    "title": "Answer submission history.",
    "key": "feature_099",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 100,
    "category": "ai_learning",
    "title": "AI marking rubric.",
    "key": "feature_100",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 101,
    "category": "ai_learning",
    "title": "Partial marks calculation.",
    "key": "feature_101",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 102,
    "category": "ai_learning",
    "title": "Missing marking points display.",
    "key": "feature_102",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 103,
    "category": "ai_learning",
    "title": "Model-answer comparison.",
    "key": "feature_103",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 104,
    "category": "ai_learning",
    "title": "Student answer vs marking scheme diff.",
    "key": "feature_104",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 105,
    "category": "ai_learning",
    "title": "Handwritten answer image marking.",
    "key": "feature_105",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 106,
    "category": "ai_learning",
    "title": "Essay image OCR and evaluation.",
    "key": "feature_106",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 107,
    "category": "ai_learning",
    "title": "Diagram marking.",
    "key": "feature_107",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 108,
    "category": "ai_learning",
    "title": "Graph marking.",
    "key": "feature_108",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 109,
    "category": "ai_learning",
    "title": "Formula validation.",
    "key": "feature_109",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 110,
    "category": "ai_learning",
    "title": "Significant-figure validation.",
    "key": "feature_110",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 111,
    "category": "ai_learning",
    "title": "Units validation.",
    "key": "feature_111",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 112,
    "category": "ai_learning",
    "title": "Sinhala spelling-tolerant marking.",
    "key": "feature_112",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 113,
    "category": "ai_learning",
    "title": "Alternative correct-answer support.",
    "key": "feature_113",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 114,
    "category": "ai_learning",
    "title": "Teacher review override.",
    "key": "feature_114",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 115,
    "category": "ai_learning",
    "title": "Re-mark request feature.",
    "key": "feature_115",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 116,
    "category": "ai_learning",
    "title": "Question bookmark.",
    "key": "feature_116",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 117,
    "category": "ai_learning",
    "title": "Difficult-question collection.",
    "key": "feature_117",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 118,
    "category": "ai_learning",
    "title": "Automatically generated flashcards.",
    "key": "feature_118",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 119,
    "category": "ai_learning",
    "title": "Formula flashcards.",
    "key": "feature_119",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 120,
    "category": "ai_learning",
    "title": "Diagram flashcards.",
    "key": "feature_120",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 121,
    "category": "ai_learning",
    "title": "Lesson summary generation.",
    "key": "feature_121",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 122,
    "category": "ai_learning",
    "title": "One-page revision sheet.",
    "key": "feature_122",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 123,
    "category": "ai_learning",
    "title": "Formula sheet generation.",
    "key": "feature_123",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 124,
    "category": "ai_learning",
    "title": "Last-minute revision mode.",
    "key": "feature_124",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 125,
    "category": "ai_learning",
    "title": "Audio lesson summaries.",
    "key": "feature_125",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 126,
    "category": "ai_learning",
    "title": "Sinhala text-to-speech.",
    "key": "feature_126",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 127,
    "category": "ai_learning",
    "title": "Playback-speed controls.",
    "key": "feature_127",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 128,
    "category": "ai_learning",
    "title": "AI voice question reading.",
    "key": "feature_128",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 129,
    "category": "ai_learning",
    "title": "Speech-to-text questions.",
    "key": "feature_129",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 130,
    "category": "ai_learning",
    "title": "Voice answer practice.",
    "key": "feature_130",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 131,
    "category": "ai_learning",
    "title": "Pronunciation-tolerant Singlish input.",
    "key": "feature_131",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 132,
    "category": "ai_learning",
    "title": "Uploaded image explanation.",
    "key": "feature_132",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 133,
    "category": "ai_learning",
    "title": "Screenshot error diagnosis.",
    "key": "feature_133",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 134,
    "category": "ai_learning",
    "title": "Console-log explanation.",
    "key": "feature_134",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 135,
    "category": "ai_learning",
    "title": "Code-error troubleshooting for ICT.",
    "key": "feature_135",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 136,
    "category": "ai_learning",
    "title": "Circuit image analysis for ET.",
    "key": "feature_136",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 137,
    "category": "ai_learning",
    "title": "Experimental setup image analysis.",
    "key": "feature_137",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 138,
    "category": "ai_learning",
    "title": "Graph image analysis.",
    "key": "feature_138",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 139,
    "category": "ai_learning",
    "title": "Table image analysis.",
    "key": "feature_139",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 140,
    "category": "ai_learning",
    "title": "Chemical/physics symbol recognition.",
    "key": "feature_140",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 141,
    "category": "ai_learning",
    "title": "Interactive formula calculator.",
    "key": "feature_141",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 142,
    "category": "ai_learning",
    "title": "Unit converter.",
    "key": "feature_142",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 143,
    "category": "ai_learning",
    "title": "Scientific notation helper.",
    "key": "feature_143",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 144,
    "category": "ai_learning",
    "title": "Graph plotting tool.",
    "key": "feature_144",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 145,
    "category": "ai_learning",
    "title": "Circuit truth-table generator.",
    "key": "feature_145",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 146,
    "category": "ai_learning",
    "title": "Database query practice tool.",
    "key": "feature_146",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 147,
    "category": "ai_learning",
    "title": "Python code runner sandbox.",
    "key": "feature_147",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 148,
    "category": "ai_learning",
    "title": "Lesson-specific AI tools.",
    "key": "feature_148",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 149,
    "category": "ai_learning",
    "title": "Tool-use result citations.",
    "key": "feature_149",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 150,
    "category": "ai_learning",
    "title": "AI conversation export.",
    "key": "feature_150",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/ai-core",
      "server/knowledge",
      "server/pdf",
      "server/learning",
      "src/components/views/CloraXView.tsx"
    ]
  },
  {
    "id": 151,
    "category": "auth_data",
    "title": "Popup login වෙනුවට reliable redirect fallback.",
    "key": "feature_151",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 152,
    "category": "auth_data",
    "title": "Redirect result එක page boot වෙද්දී process කිරීම.",
    "key": "feature_152",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 153,
    "category": "auth_data",
    "title": "Anonymous Firebase users disable කිරීම.",
    "key": "feature_153",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 154,
    "category": "auth_data",
    "title": "Auth-loading timeout and retry.",
    "key": "feature_154",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 155,
    "category": "auth_data",
    "title": "Offline login-state recovery.",
    "key": "feature_155",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 156,
    "category": "auth_data",
    "title": "Duplicate login requests prevent කිරීම.",
    "key": "feature_156",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 157,
    "category": "auth_data",
    "title": "API session creation retry.",
    "key": "feature_157",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 158,
    "category": "auth_data",
    "title": "Expired token automatic refresh.",
    "key": "feature_158",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 159,
    "category": "auth_data",
    "title": "Cross-tab login synchronization.",
    "key": "feature_159",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 160,
    "category": "auth_data",
    "title": "Logout all devices.",
    "key": "feature_160",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 161,
    "category": "auth_data",
    "title": "Session-device list.",
    "key": "feature_161",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 162,
    "category": "auth_data",
    "title": "Suspicious-login alert.",
    "key": "feature_162",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 163,
    "category": "auth_data",
    "title": "Google profile image fallback.",
    "key": "feature_163",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 164,
    "category": "auth_data",
    "title": "Profile image caching.",
    "key": "feature_164",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 165,
    "category": "auth_data",
    "title": "Broken-avatar fallback.",
    "key": "feature_165",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 166,
    "category": "auth_data",
    "title": "Profile data progressive loading.",
    "key": "feature_166",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 167,
    "category": "auth_data",
    "title": "Page-specific data fetching.",
    "key": "feature_167",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 168,
    "category": "auth_data",
    "title": "Duplicate Firestore reads prevent කිරීම.",
    "key": "feature_168",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 169,
    "category": "auth_data",
    "title": "SWR/React Query caching.",
    "key": "feature_169",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 170,
    "category": "auth_data",
    "title": "Optimistic profile updates.",
    "key": "feature_170",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 171,
    "category": "auth_data",
    "title": "User-data schema validation.",
    "key": "feature_171",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 172,
    "category": "auth_data",
    "title": "Firestore undefined values sanitize කිරීම.",
    "key": "feature_172",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 173,
    "category": "auth_data",
    "title": "Server-side user ownership checks.",
    "key": "feature_173",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 174,
    "category": "auth_data",
    "title": "Email-path වෙනුවට UID-based documents.",
    "key": "feature_174",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 175,
    "category": "auth_data",
    "title": "Old email-based data migration.",
    "key": "feature_175",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 176,
    "category": "auth_data",
    "title": "Admin role via Firebase custom claims.",
    "key": "feature_176",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 177,
    "category": "auth_data",
    "title": "Content-editor role.",
    "key": "feature_177",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 178,
    "category": "auth_data",
    "title": "Account deletion flow.",
    "key": "feature_178",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 179,
    "category": "auth_data",
    "title": "Data export flow.",
    "key": "feature_179",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 180,
    "category": "auth_data",
    "title": "Privacy settings.",
    "key": "feature_180",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server/auth",
      "server/firebase",
      "server/utils/authGuards.ts",
      "src/context/AppContext.tsx"
    ]
  },
  {
    "id": 181,
    "category": "performance_reliability",
    "title": "Large route bundles code-split කිරීම.",
    "key": "feature_181",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 182,
    "category": "performance_reliability",
    "title": "Chart libraries lazy-load කිරීම.",
    "key": "feature_182",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 183,
    "category": "performance_reliability",
    "title": "PDF.js only when needed load කිරීම.",
    "key": "feature_183",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 184,
    "category": "performance_reliability",
    "title": "Video player lazy-load කිරීම.",
    "key": "feature_184",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 185,
    "category": "performance_reliability",
    "title": "Admin dashboard separate chunk.",
    "key": "feature_185",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 186,
    "category": "performance_reliability",
    "title": "AI page separate chunk.",
    "key": "feature_186",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 187,
    "category": "performance_reliability",
    "title": "Route prefetch on hover.",
    "key": "feature_187",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 188,
    "category": "performance_reliability",
    "title": "Critical CSS optimization.",
    "key": "feature_188",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 189,
    "category": "performance_reliability",
    "title": "Unused CSS removal.",
    "key": "feature_189",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 190,
    "category": "performance_reliability",
    "title": "Image WebP/AVIF conversion.",
    "key": "feature_190",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 191,
    "category": "performance_reliability",
    "title": "Responsive image sizes.",
    "key": "feature_191",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 192,
    "category": "performance_reliability",
    "title": "Long-term asset caching.",
    "key": "feature_192",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 193,
    "category": "performance_reliability",
    "title": "Profile image CDN caching.",
    "key": "feature_193",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 194,
    "category": "performance_reliability",
    "title": "API response compression.",
    "key": "feature_194",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 195,
    "category": "performance_reliability",
    "title": "Firestore query pagination.",
    "key": "feature_195",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 196,
    "category": "performance_reliability",
    "title": "Notifications pagination.",
    "key": "feature_196",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 197,
    "category": "performance_reliability",
    "title": "Chat history pagination.",
    "key": "feature_197",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 198,
    "category": "performance_reliability",
    "title": "Past-paper infinite scrolling.",
    "key": "feature_198",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 199,
    "category": "performance_reliability",
    "title": "Search input debouncing.",
    "key": "feature_199",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 200,
    "category": "performance_reliability",
    "title": "Duplicate API-call cancellation.",
    "key": "feature_200",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 201,
    "category": "performance_reliability",
    "title": "Request timeout handling.",
    "key": "feature_201",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 202,
    "category": "performance_reliability",
    "title": "Exponential retry.",
    "key": "feature_202",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 203,
    "category": "performance_reliability",
    "title": "Retry-After support.",
    "key": "feature_203",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 204,
    "category": "performance_reliability",
    "title": "Circuit breaker for AI providers.",
    "key": "feature_204",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 205,
    "category": "performance_reliability",
    "title": "Gemini/OpenAI provider fallback.",
    "key": "feature_205",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 206,
    "category": "performance_reliability",
    "title": "Model-health cache.",
    "key": "feature_206",
    "state": "foundation",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 207,
    "category": "performance_reliability",
    "title": "Server cold-start reduction.",
    "key": "feature_207",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 208,
    "category": "performance_reliability",
    "title": "Heavy imports dynamic-load කිරීම.",
    "key": "feature_208",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 209,
    "category": "performance_reliability",
    "title": "Background OCR queue.",
    "key": "feature_209",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 210,
    "category": "performance_reliability",
    "title": "Background video-processing queue.",
    "key": "feature_210",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 211,
    "category": "performance_reliability",
    "title": "Resumable upload recovery.",
    "key": "feature_211",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 212,
    "category": "performance_reliability",
    "title": "Upload pause/resume.",
    "key": "feature_212",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 213,
    "category": "performance_reliability",
    "title": "Network reconnect continuation.",
    "key": "feature_213",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 214,
    "category": "performance_reliability",
    "title": "Offline draft saving.",
    "key": "feature_214",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 215,
    "category": "performance_reliability",
    "title": "Service worker update prompt.",
    "key": "feature_215",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 216,
    "category": "performance_reliability",
    "title": "Stale asset-version recovery.",
    "key": "feature_216",
    "state": "available",
    "priority": "medium",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 217,
    "category": "performance_reliability",
    "title": "Dynamic-import failure auto reload.",
    "key": "feature_217",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 218,
    "category": "performance_reliability",
    "title": "Error boundary per route.",
    "key": "feature_218",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 219,
    "category": "performance_reliability",
    "title": "Health dashboard.",
    "key": "feature_219",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 220,
    "category": "performance_reliability",
    "title": "Automated synthetic monitoring.",
    "key": "feature_220",
    "state": "planned",
    "priority": "medium",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/lib/api.ts",
      "server/utils/retry.ts",
      "server/ai/aiCircuitBreaker.ts",
      "server/pdf/processingPipeline.ts"
    ]
  },
  {
    "id": 221,
    "category": "ui_ux",
    "title": "Single consistent white design system.",
    "key": "feature_221",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 222,
    "category": "ui_ux",
    "title": "Unified color tokens.",
    "key": "feature_222",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 223,
    "category": "ui_ux",
    "title": "Unified spacing scale.",
    "key": "feature_223",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 224,
    "category": "ui_ux",
    "title": "Unified border radius.",
    "key": "feature_224",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 225,
    "category": "ui_ux",
    "title": "Unified shadow system.",
    "key": "feature_225",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 226,
    "category": "ui_ux",
    "title": "Consistent typography hierarchy.",
    "key": "feature_226",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 227,
    "category": "ui_ux",
    "title": "Sinhala-compatible font stack.",
    "key": "feature_227",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 228,
    "category": "ui_ux",
    "title": "Dark navy only for primary actions.",
    "key": "feature_228",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 229,
    "category": "ui_ux",
    "title": "Green only for completed states.",
    "key": "feature_229",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 230,
    "category": "ui_ux",
    "title": "Red only for errors/destructive actions.",
    "key": "feature_230",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 231,
    "category": "ui_ux",
    "title": "Consistent button heights.",
    "key": "feature_231",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 232,
    "category": "ui_ux",
    "title": "Consistent form field heights.",
    "key": "feature_232",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 233,
    "category": "ui_ux",
    "title": "Clear hover states.",
    "key": "feature_233",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 234,
    "category": "ui_ux",
    "title": "Clear keyboard-focus states.",
    "key": "feature_234",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 235,
    "category": "ui_ux",
    "title": "Smooth page transitions.",
    "key": "feature_235",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 236,
    "category": "ui_ux",
    "title": "Route-specific skeletons.",
    "key": "feature_236",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 237,
    "category": "ui_ux",
    "title": "Skeleton dimensions match final content.",
    "key": "feature_237",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 238,
    "category": "ui_ux",
    "title": "Avoid full-page spinner after initial load.",
    "key": "feature_238",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 239,
    "category": "ui_ux",
    "title": "Preserve previous page data during tab switching.",
    "key": "feature_239",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 240,
    "category": "ui_ux",
    "title": "Empty-state illustrations without “AI-generated” appearance.",
    "key": "feature_240",
    "state": "planned",
    "priority": "normal",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 241,
    "category": "ui_ux",
    "title": "Sidebar tooltips when collapsed.",
    "key": "feature_241",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 242,
    "category": "ui_ux",
    "title": "Sidebar active-item indicator.",
    "key": "feature_242",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 243,
    "category": "ui_ux",
    "title": "Mobile bottom navigation.",
    "key": "feature_243",
    "state": "planned",
    "priority": "normal",
    "defaultEnabled": false,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 244,
    "category": "ui_ux",
    "title": "Mobile safe-area support.",
    "key": "feature_244",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 245,
    "category": "ui_ux",
    "title": "Keyboard-open viewport handling.",
    "key": "feature_245",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 246,
    "category": "ui_ux",
    "title": "Chat composer attach to keyboard.",
    "key": "feature_246",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 247,
    "category": "ui_ux",
    "title": "Auto-growing textarea with maximum height.",
    "key": "feature_247",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 248,
    "category": "ui_ux",
    "title": "Mobile composer smaller padding.",
    "key": "feature_248",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 249,
    "category": "ui_ux",
    "title": "Scroll-to-latest button.",
    "key": "feature_249",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 250,
    "category": "ui_ux",
    "title": "Restore chat scroll position.",
    "key": "feature_250",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 251,
    "category": "ui_ux",
    "title": "Prevent horizontal mobile overflow.",
    "key": "feature_251",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 252,
    "category": "ui_ux",
    "title": "Modal height use `dvh`.",
    "key": "feature_252",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 253,
    "category": "ui_ux",
    "title": "Modal body independent scrolling.",
    "key": "feature_253",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 254,
    "category": "ui_ux",
    "title": "Sticky modal header.",
    "key": "feature_254",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 255,
    "category": "ui_ux",
    "title": "Sticky modal actions.",
    "key": "feature_255",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 256,
    "category": "ui_ux",
    "title": "Responsive paper cards.",
    "key": "feature_256",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 257,
    "category": "ui_ux",
    "title": "Responsive charts.",
    "key": "feature_257",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 258,
    "category": "ui_ux",
    "title": "Accessible chart summaries.",
    "key": "feature_258",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 259,
    "category": "ui_ux",
    "title": "Reduced-motion setting.",
    "key": "feature_259",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 260,
    "category": "ui_ux",
    "title": "Custom lightweight scrollbar.",
    "key": "feature_260",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "src/App.tsx",
      "src/styles/clora-design.css",
      "src/components/ui",
      "src/pages/FeatureCenter.tsx"
    ]
  },
  {
    "id": 261,
    "category": "files_media",
    "title": "Simple file-row UI without fake previews.",
    "key": "feature_261",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 262,
    "category": "files_media",
    "title": "Clear file-type icon.",
    "key": "feature_262",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 263,
    "category": "files_media",
    "title": "Human-readable file size.",
    "key": "feature_263",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 264,
    "category": "files_media",
    "title": "Open/download actions grouped consistently.",
    "key": "feature_264",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 265,
    "category": "files_media",
    "title": "Upload percentage.",
    "key": "feature_265",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 266,
    "category": "files_media",
    "title": "Uploaded size/full size.",
    "key": "feature_266",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 267,
    "category": "files_media",
    "title": "Remaining size.",
    "key": "feature_267",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 268,
    "category": "files_media",
    "title": "Upload speed.",
    "key": "feature_268",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 269,
    "category": "files_media",
    "title": "ETA.",
    "key": "feature_269",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 270,
    "category": "files_media",
    "title": "Cancel and retry.",
    "key": "feature_270",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 271,
    "category": "files_media",
    "title": "Uploaded video persistent database record.",
    "key": "feature_271",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 272,
    "category": "files_media",
    "title": "Video processing state machine.",
    "key": "feature_272",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 273,
    "category": "files_media",
    "title": "Processing failure reason.",
    "key": "feature_273",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 274,
    "category": "files_media",
    "title": "HLS adaptive-quality generation.",
    "key": "feature_274",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 275,
    "category": "files_media",
    "title": "Quality selector.",
    "key": "feature_275",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 276,
    "category": "files_media",
    "title": "Short-lived playback sessions.",
    "key": "feature_276",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 277,
    "category": "files_media",
    "title": "Signed segment URLs/cookies.",
    "key": "feature_277",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 278,
    "category": "files_media",
    "title": "Per-user visible watermark.",
    "key": "feature_278",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 279,
    "category": "files_media",
    "title": "Disable raw MP4 production fallback.",
    "key": "feature_279",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 280,
    "category": "files_media",
    "title": "Existing videos secure-HLS reprocessing tool.",
    "key": "feature_280",
    "state": "available",
    "priority": "normal",
    "defaultEnabled": true,
    "implementationRefs": [
      "server/pdf",
      "server/video",
      "src/components/video/SecureVideoPlayer.tsx",
      "src/components/views/SyllabusLibraryView.tsx"
    ]
  },
  {
    "id": 281,
    "category": "security_quality",
    "title": "Revoke exposed Firebase service-account key.",
    "key": "feature_281",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 282,
    "category": "security_quality",
    "title": "Use one server credential JSON variable.",
    "key": "feature_282",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 283,
    "category": "security_quality",
    "title": "Secret-format validation without exposing values.",
    "key": "feature_283",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 284,
    "category": "security_quality",
    "title": "Firebase App Check enforcement.",
    "key": "feature_284",
    "state": "foundation",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 285,
    "category": "security_quality",
    "title": "Firestore rules automated tests.",
    "key": "feature_285",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 286,
    "category": "security_quality",
    "title": "Storage rules automated tests.",
    "key": "feature_286",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 287,
    "category": "security_quality",
    "title": "Rate limit by UID and IP.",
    "key": "feature_287",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 288,
    "category": "security_quality",
    "title": "Upload MIME/signature validation.",
    "key": "feature_288",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 289,
    "category": "security_quality",
    "title": "Antivirus/malware scanning.",
    "key": "feature_289",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 290,
    "category": "security_quality",
    "title": "CSP and security headers.",
    "key": "feature_290",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 291,
    "category": "security_quality",
    "title": "Dependency vulnerability updates.",
    "key": "feature_291",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 292,
    "category": "security_quality",
    "title": "Automated unit tests on every PR.",
    "key": "feature_292",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 293,
    "category": "security_quality",
    "title": "Authentication E2E tests.",
    "key": "feature_293",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 294,
    "category": "security_quality",
    "title": "PDF-QA E2E tests.",
    "key": "feature_294",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 295,
    "category": "security_quality",
    "title": "Video upload/playback E2E tests.",
    "key": "feature_295",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 296,
    "category": "security_quality",
    "title": "Structured logs with request IDs.",
    "key": "feature_296",
    "state": "available",
    "priority": "high",
    "defaultEnabled": true,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 297,
    "category": "security_quality",
    "title": "Google SEO landing pages by year/subject/lesson.",
    "key": "feature_297",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 298,
    "category": "security_quality",
    "title": "Sinhala/English/Singlish keyword metadata.",
    "key": "feature_298",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 299,
    "category": "security_quality",
    "title": "Sitemap, canonical URL and structured-data generation.",
    "key": "feature_299",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  },
  {
    "id": 300,
    "category": "security_quality",
    "title": "Core Web Vitals, error-rate and learning-outcome analytics.",
    "key": "feature_300",
    "state": "planned",
    "priority": "high",
    "defaultEnabled": false,
    "implementationRefs": [
      "server.ts",
      "server/utils",
      "firestore.rules",
      "scripts",
      "docs/security"
    ]
  }
];

export function getFeatureById(id: number): PlatformFeature | undefined {
  return PLATFORM_FEATURES.find((feature) => feature.id === id);
}

export function summarizeFeatureCatalog(features: PlatformFeature[] = PLATFORM_FEATURES) {
  const byState: Record<FeatureDeliveryState, number> = { available: 0, foundation: 0, planned: 0 };
  const byCategory = Object.fromEntries(
    Object.keys(FEATURE_CATEGORY_LABELS).map((category) => [category, { total: 0, available: 0, foundation: 0, planned: 0 }]),
  ) as Record<FeatureCategory, { total: number; available: number; foundation: number; planned: number }>;

  for (const feature of features) {
    byState[feature.state] += 1;
    byCategory[feature.category].total += 1;
    byCategory[feature.category][feature.state] += 1;
  }

  return {
    total: features.length,
    byState,
    byCategory,
    productionReadyPercent: Math.round((byState.available / Math.max(features.length, 1)) * 100),
    integratedPercent: Math.round(((byState.available + byState.foundation) / Math.max(features.length, 1)) * 100),
  };
}
