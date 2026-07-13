import { normalizeFileName, normalizeSubject } from "../source-normalization";
import { generateSourceAliases } from "../source-aliases";
import { SourceRecordSchema } from "../source.schemas";
import { isValidProcessingTransition } from "../source-transitions";
import { parseQuestionRef } from "../question-parser";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTests() {
  console.log("Running Source Registry v2 Unit Tests...");

  // 1. Filename Normalization Tests
  console.log("- Testing Filename Normalization...");
  const norm1 = normalizeFileName("2025_SFT_Final.PDF");
  assert(norm1.normalizedName === "2025 sft final.pdf", "Basic normalization name");
  assert(norm1.normalizedStem === "2025 sft final", "Basic normalization stem");
  
  const norm2 = normalizeFileName("  2025   SFT__Final .pdf ");
  assert(norm2.normalizedStem === "2025 sft final", "Whitespace and separator normalization");
  
  const sinhala = "2025_තාපය_ප්රශ්න පත්රය.PDF";
  const norm3 = normalizeFileName(sinhala);
  assert(norm3.normalizedStem.includes("තාපය"), "Sinhala preservation");
  assert(norm3.extension === "pdf", "Extension extraction");

  // 2. Subject Normalization Tests
  console.log("- Testing Subject Normalization...");
  assert(normalizeSubject("Science for Technology") === "SFT", "Subject normalization 1");
  assert(normalizeSubject("විද්‍යාව තාක්ෂණය සඳහා") === "SFT", "Subject normalization Sinhala");
  assert(normalizeSubject("unknown") === undefined, "Subject normalization unknown");

  // 3. Alias Generation Tests
  console.log("- Testing Alias Generation...");
  const aliases = generateSourceAliases({
    originalFileName: "test.pdf",
    subject: "SFT",
    year: 2025,
    resourceRole: "past_paper",
    paperPart: "1"
  });
  assert(aliases.includes("2025 sft"), "Year subject alias");
  assert(aliases.includes("mcq"), "Paper part alias");
  assert(aliases.includes("past paper"), "Resource role alias");

  // 4. Schema Validation Tests
  console.log("- Testing Schema Validation...");
  const validRecord = {
    sourceId: "src_123",
    ownerUid: "user_456",
    notebookIds: [],
    visibility: "private",
    displayTitle: "Test Source",
    originalFileName: "test.pdf",
    normalizedName: "test.pdf",
    normalizedStem: "test",
    aliases: ["test"],
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // Empty file hash
    sourceVersion: 1,
    processingVersion: 1,
    mimeType: "application/pdf",
    mediaKind: "pdf",
    resourceRole: "past_paper",
    sizeBytes: 1024,
    processingStatus: "ready",
    chunkCount: 10,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    storagePath: "sources/user_456/src_123/original"
  };
  
  const result = SourceRecordSchema.safeParse(validRecord);
  if (!result.success) {
      console.error(result.error);
      assert(false, "Schema validation failed for valid record");
  }

  // 5. Transition Tests
  console.log("- Testing Transitions...");
  assert(isValidProcessingTransition("uploaded", "queued"), "uploaded -> queued");
  assert(isValidProcessingTransition("extracting", "ocr_required"), "extracting -> ocr_required");
  assert(!isValidProcessingTransition("deleted", "ready"), "deleted -> ready (illegal)");

  // 6. Question Parser Tests (Part 04A)
  console.log("- Testing Question Parser (Part 04A)...");
  const testCases = [
    {
      input: "SFT 2023 Paper I Q5",
      expected: {
        subject: "SFT",
        year: 2023,
        paperPart: "Paper I",
        questionType: "mcq",
        questionNumber: 5,
        canonicalQuestionKey: "v1:sft:2023:paper_i:mcq:q5",
      }
    },
    {
      input: "2020 ET Paper II Part A Q1(a)(iii)",
      expected: {
        subject: "ET",
        year: 2020,
        paperPart: "Paper II",
        questionType: "structured",
        questionNumber: 1,
        subparts: ["a", "iii"],
        canonicalQuestionKey: "v1:et:2020:paper_ii:structured:q1:a_iii",
      }
    },
    {
      input: "2022 ICT Paper II Q5 (අ) (i)",
      expected: {
        subject: "ICT",
        year: 2022,
        paperPart: "Paper II",
        questionType: "essay",
        questionNumber: 5,
        subparts: ["අ", "i"],
        canonicalQuestionKey: "v1:ict:2022:paper_ii:essay:q5:අ_i",
      }
    },
    {
      input: "ප්‍රශ්න අංක 01 - 2021 SFT සිංහල",
      expected: {
        subject: "SFT",
        year: 2021,
        questionNumber: 1,
        medium: "sinhala",
      }
    },
    {
      input: "MCQ 12 - 2018 ET",
      expected: {
        subject: "ET",
        year: 2018,
        questionNumber: 12,
        questionType: "mcq",
      }
    },
    {
      input: "2023 A/L ඉංජිනේරු තාක්ෂණවේදය පළමු පත්‍රය - 05 ප්‍රශ්නය",
      expected: {
        subject: "ET",
        year: 2023,
        paperPart: "Paper I",
        questionNumber: 5,
      }
    },
    {
      input: "පළමුවන ප්‍රශ්නය - SFT 2023",
      expected: {
        subject: "SFT",
        year: 2023,
        questionNumber: 1,
      }
    },
    {
      input: "දෙවන කොටස ප්‍රශ්න අංක 4 - SFT '22",
      expected: {
        subject: "SFT",
        year: 2022,
        questionNumber: 4,
        paperPart: "Paper II",
      }
    },
    {
      input: "SFT Marking Scheme 2020",
      expected: {
        subject: "SFT",
        year: 2020,
        resourceRole: "marking_scheme",
      }
    },
    {
      input: "malformed text with no indicators",
      expected: {
        subject: "unknown",
        year: "unknown",
        questionNumber: "unknown",
        canonicalQuestionKey: "",
      }
    }
  ];

  for (const tc of testCases) {
    const res = parseQuestionRef(tc.input);
    for (const [key, value] of Object.entries(tc.expected)) {
      if (Array.isArray(value)) {
        assert(JSON.stringify(res[key as keyof typeof res]) === JSON.stringify(value), `Value mismatch for '${key}' on input: "${tc.input}". Expected: ${JSON.stringify(value)}, Got: ${JSON.stringify(res[key as keyof typeof res])}`);
      } else {
        assert(res[key as keyof typeof res] === value, `Value mismatch for '${key}' on input: "${tc.input}". Expected: ${value}, Got: ${res[key as keyof typeof res]}`);
      }
    }
  }

  console.log("\nALL TESTS PASSED!");
}

try {
  runTests();
} catch (e) {
  console.error(e);
  process.exit(1);
}
