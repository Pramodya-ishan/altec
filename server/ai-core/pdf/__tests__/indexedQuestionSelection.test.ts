import assert from "node:assert/strict";
import { hasExactQuestionMarker, selectIndexedQuestionChunks } from "../indexedQuestionSelection";

const noMarker = [
  { id: "a", text: "General introduction without a numbered question", chunkIndex: 0, pageNumber: 1 },
  { id: "b", text: "More unrelated lesson text", chunkIndex: 1, pageNumber: 1 },
];
assert.deepEqual(selectIndexedQuestionChunks(noMarker, "1"), [], "Q1 must not fall back to the first chunks");

const exact = [
  { id: "a", text: "Introduction", chunkIndex: 0, pageNumber: 1 },
  { id: "b", text: "Question 1: State the answer.", chunkIndex: 1, pageNumber: 2 },
  { id: "c", text: "Continuation of Question 1", chunkIndex: 2, pageNumber: 2 },
];
const selected = selectIndexedQuestionChunks(exact, "1");
assert.ok(selected.some((chunk) => chunk.id === "b"));

assert.equal(hasExactQuestionMarker("\nQuestion No. 06\nAnswer every part.", "6"), true);
assert.equal(hasExactQuestionMarker("\nESSAY 06: Answer all sections.\n", "6"), true);
assert.equal(hasExactQuestionMarker("\n06' (A) Explain the process.\n", "6"), true);
assert.equal(hasExactQuestionMarker("Page 6 of 20", "6"), false, "page numbers are not question markers");

const essayPages = [
  { id: "p10", text: "Previous page", chunkIndex: 9, pageNumber: 10 },
  { id: "p11", text: "Question No. 06\n(A) Explain the process.", chunkIndex: 10, pageNumber: 11 },
  { id: "p12", text: "(B) Continue the same main question.", chunkIndex: 11, pageNumber: 12 },
  { id: "p13", text: "(C) Final section.", chunkIndex: 12, pageNumber: 13 },
];
const essayWindow = selectIndexedQuestionChunks(essayPages, "6");
assert.deepEqual(essayWindow.map((page) => page.id), ["p10", "p11", "p12", "p13"]);

console.log("Indexed question selection tests passed.");
