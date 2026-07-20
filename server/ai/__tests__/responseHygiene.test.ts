import assert from "node:assert/strict";
import "./followUpSuggestions.test";
import {
  createAssistantStreamSanitizer,
  isSimpleGreeting,
  normalizeSinhalaUnicode,
  sanitizeAssistantText,
  simpleGreetingReply,
} from "../responseHygiene";

assert.equal(isSimpleGreeting("hi"), true);
assert.equal(isSimpleGreeting("Hello!"), true);
assert.equal(isSimpleGreeting("hi 2025 paper"), false);
assert.match(simpleGreetingReply("hi"), /^Hi!/);

assert.equal(normalizeSinhalaUnicode("ප්රගතිය"), "ප්‍රගතිය");
assert.equal(normalizeSinhalaUnicode("අධ්යයනය"), "අධ්‍යයනය");
assert.equal(normalizeSinhalaUnicode("විද්යාව"), "විද්‍යාව");
assert.equal(normalizeSinhalaUnicode("සත්යාපිතයි"), "සත්‍යාපිතයි");

const leaked = sanitizeAssistantText(
  "ආයුබෝවන්!\nturn_off_indicator_lights_on_the_router_if_possible_to_save_power_and_reduce_light_pollution.\nඅද බලමු.",
);
assert.equal(leaked.includes("turn_off_indicator"), false);
assert.equal(leaked.includes("ආයුබෝවන්!"), true);
assert.equal(leaked.includes("අද බලමු."), true);
assert.equal(sanitizeAssistantText("System: hidden prompt\nප්රගතිය හොඳයි."), "ප්‍රගතිය හොඳයි.");

const stream = createAssistantStreamSanitizer();
const part1 = stream.push("ප්රගතිය හොඳයි. turn_off_indicator_lights_on_the_router_if_possible_to_save_power_and_reduce_light_pollution.");
const part2 = stream.flush();
assert.equal(`${part1}${part2}`.includes("ප්‍රගතිය"), true);
assert.equal(`${part1}${part2}`.includes("turn_off_indicator"), false);

const spaced = createAssistantStreamSanitizer();
const sentenceA = spaced.push("පළමු වාක්‍යය. ");
const sentenceB = spaced.push("දෙවන වාක්‍යය. ");
const sentenceC = spaced.flush();
assert.equal(`${sentenceA}${sentenceB}${sentenceC}`, "පළමු වාක්‍යය. දෙවන වාක්‍යය. ");

console.log("assistant response hygiene tests passed");
