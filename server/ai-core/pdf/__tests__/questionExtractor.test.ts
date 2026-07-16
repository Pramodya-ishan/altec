import assert from "node:assert/strict";
import { extractQuestionFromFullPaper } from "../questionExtractor";
import { formatPaperQuestionAnswer } from "../../../../shared/text/paperAnswer";

const chunks = [
  {
    pageNumber: 1,
    chunkIndex: 0,
    text: [
      "4. පෙර ප්‍රශ්නය කුමක්ද? (1) A (2) B (3) C (4) D (5) E",
      "5. X නම් ඩයිසැකරයිඩයේ ජල විච්ඡේදනය සලකන්න. X + ජලය → ග්ලුකෝස් + ගැලැක්ටෝස්. X යනු කුමක්ද? (1) ලැක්ටෝස් (2) සුක්‍රෝස් (3) මෝල්ටෝස් (4) සෙලෝබියෝස් (5) ගැලැක්ටෝස්",
      "6. ඊළඟ ප්‍රශ්නය කුමක්ද? (1) F (2) G (3) H (4) I (5) J",
    ].join("\n"),
  },
  {
    pageNumber: 1,
    chunkIndex: 1,
    text: "X යනු කුමක්ද? (1) ලැක්ටෝස් (2) සුක්‍රෝස් (3) මෝල්ටෝස් (4) සෙලෝබියෝස් (5) ගැලැක්ටෝස්\n6. ඊළඟ ප්‍රශ්නය කුමක්ද? (1) F (2) G (3) H (4) I (5) J",
  },
];

const extracted = extractQuestionFromFullPaper(chunks, "5", "MCQ");
assert.equal(extracted.found, true);
assert.equal(extracted.questionNo, "5");
assert.equal(extracted.options.length, 5);
assert.match(extracted.questionText || "", /^5\./);
assert.doesNotMatch(extracted.rawBlock || "", /6\. ඊළඟ/);
assert.doesNotMatch(extracted.rawBlock || "", /4\. පෙර/);

const answer = formatPaperQuestionAnswer({
  questionText: extracted.questionText,
  options: extracted.options,
  solvedAnswer: {
    optionNo: "1",
    optionText: "ලැක්ටෝස්",
    explanationSinhala: "ලැක්ටෝස් ජල විච්ඡේදනයෙන් ග්ලුකෝස් සහ ගැලැක්ටෝස් ලැබේ.",
  },
});
assert.match(answer, /\*\*පිළිතුර:\*\* \(1\) ලැක්ටෝස්/);
assert.doesNotMatch(answer, /Source Status|Estimated Answer|Mark Split|Found\/Imported/);

const orphanVirama = extractQuestionFromFullPaper([
  {
    pageNumber: 2,
    chunkIndex: 0,
    text: "5. ්ප්‍රශ්නය නිවැරදිව කියවන්න. (1) A (2) B (3) C (4) D (5) E\n6. Next (1) A (2) B (3) C (4) D (5) E",
  },
], "5", "MCQ");
assert.equal(orphanVirama.found, true);
assert.doesNotMatch(orphanVirama.questionText || "", /්ප්‍ර/);

console.log("full-paper question extraction regression tests passed");
