import assert from "node:assert/strict";
import { selectIndexedQuestionChunks } from "../indexedQuestionSelection";

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

console.log("Indexed question selection tests passed.");
