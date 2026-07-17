import assert from "node:assert/strict";
import { normalizeSinhalaDisplayText, sanitizeAssistantDisplayText } from "../assistantTextHygiene";

assert.equal(normalizeSinhalaDisplayText("ප්රගතිය"), "ප්‍රගතිය");
assert.equal(normalizeSinhalaDisplayText("අධ්යයනය"), "අධ්‍යයනය");
assert.equal(normalizeSinhalaDisplayText("විද්යාව"), "විද්‍යාව");

const cleaned = sanitizeAssistantDisplayText(
  "ආයුබෝවන්!\nturn_off_indicator_lights_on_the_router_if_possible_to_save_power_and_reduce_light_pollution.\nප්රගතිය හොඳයි.",
);
assert.equal(cleaned.includes("turn_off_indicator"), false);
assert.equal(cleaned.includes("ප්‍රගතිය"), true);

const code = sanitizeAssistantDisplayText("```ts\nconst long_snake_case_identifier_for_a_real_example = true;\n```");
assert.equal(code.includes("long_snake_case_identifier_for_a_real_example"), true);

console.log("assistant display text hygiene tests passed");
