import assert from "node:assert/strict";
import {
  buildFastConversationAnswer,
  classifyFastConversationIntent,
  resolveFastConversation,
} from "../fastConversation";

assert.equal(classifyFastConversationIntent("i kwd pyaw hduwe"), "assistant_creator");
assert.equal(classifyFastConversationIntent("ඔයාව කවුද හැදුවේ?"), "assistant_creator");
assert.equal(classifyFastConversationIntent("Who created you?"), "assistant_creator");
assert.equal(classifyFastConversationIntent("oya kawda"), "assistant_identity");
assert.equal(classifyFastConversationIntent("what can you do?"), "assistant_capabilities");
assert.equal(classifyFastConversationIntent("oya kohomada"), "wellbeing");
assert.equal(classifyFastConversationIntent("hari"), "acknowledgement");
assert.equal(classifyFastConversationIntent("thanks"), "thanks");

assert.equal(classifyFastConversationIntent("2026 SFT paper එකට සංඛ්‍යානය ගණනක් දෙන්න"), null);
assert.equal(classifyFastConversationIntent("guessing paper 1 essay q6"), null);
assert.equal(classifyFastConversationIntent("බලය පාඩම රූපයක් සමඟ පැහැදිලි කරන්න"), null);

const reply = resolveFastConversation("i kwd pyaw hduwe");
assert.equal(reply?.intent, "assistant_creator");
assert.match(reply?.answer || "", /Pramodya Ishan/u);
assert.doesNotMatch(reply?.answer || "", /AI-verified|Sources|මේක රූපයක්/u);
assert.ok(buildFastConversationAnswer("assistant_capabilities").length > 30);

console.log("Fast conversation tests passed.");
