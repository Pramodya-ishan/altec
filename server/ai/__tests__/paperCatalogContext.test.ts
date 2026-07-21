import assert from "node:assert/strict";
import {
  detectExplicitPaperSubject,
  extractRequestedPaperYear,
  isPaperCatalogListPrompt,
  isPaperSelectionPrompt,
  paperCatalogYears,
  rankPaperCatalogSources,
} from "../paperCatalogContext";

const sources = [
  { id: "et-2024-paper", title: "2024 ET Full Paper", subject: "ET", year: "2024", resourceType: "past_paper", storagePath: "papers/et-2024.pdf", chunkCount: 10 },
  { id: "et-2024-scheme", title: "2024 ET Marking Scheme", subject: "ET", year: "2024", resourceType: "marking_scheme", storagePath: "papers/et-2024-sm.pdf" },
  { id: "et-2023-paper", title: "2023 Engineering Technology Paper", subject: "ET", year: "2023", resourceType: "past_paper", storagePath: "papers/et-2023.pdf" },
  { id: "sft-2023-paper", title: "2023 SFT Paper", subject: "SFT", year: "2023", resourceType: "past_paper" },
];

assert.equal(detectExplicitPaperSubject("2024 et electronic prshn krmu"), "ET");
assert.equal(extractRequestedPaperYear("2023 krmu"), "2023");
assert.equal(isPaperSelectionPrompt("2024 et electronic prshn krmu"), true);
assert.equal(isPaperSelectionPrompt("31 mcq"), false);
assert.equal(isPaperCatalogListPrompt("2023, 2022, 2021, 2020 to 2015 papers tiken mond thiyenne et"), true);
assert.equal(rankPaperCatalogSources(sources, { subject: "ET", year: "2024" })[0].source.id, "et-2024-paper");
assert.deepEqual(paperCatalogYears(sources, "ET"), ["2024", "2023"]);

console.log("Paper catalog context tests passed.");
