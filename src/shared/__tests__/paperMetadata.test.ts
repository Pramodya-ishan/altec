import assert from "node:assert/strict";
import { inferPaperMetadata } from "../paperMetadata";

const essay = inferPaperMetadata("2025 Science for Technology Guessing 01 Essay.pdf");
assert.equal(essay.year, "2025");
assert.equal(essay.subject, "SFT");
assert.equal(essay.category, "Model Papers");
assert.equal(essay.paperType, "Essay");
assert.equal(essay.paperNumber, "1");

const scheme = inferPaperMetadata("2019 ET Marking Scheme Sinhala Medium.pdf");
assert.equal(scheme.category, "Marking Schemes");
assert.equal(scheme.resourceType, "marking_scheme");
assert.equal(scheme.subject, "ET");
assert.equal(scheme.medium, "Sinhala");

const content = inferPaperMetadata("scan.pdf", "G.C.E. A/L 2021 Information and Communication Technology - Multiple Choice");
assert.equal(content.subject, "ICT");
assert.equal(content.paperType, "MCQ");
assert.equal(content.year, "2021");

console.log("paper metadata inference tests passed");
