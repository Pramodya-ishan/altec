import assert from "node:assert/strict";
import { canonicalizePastPaperSource, inferResourceType } from "../sourceInventoryService";
import { isStudentVisibleSource } from "../../utils/contentPermissions";

const legacy = canonicalizePastPaperSource({ id: "p1", title: "2024 ET Full Paper", category: "A/L Past Papers" });
assert.equal(legacy.published, true);
assert.equal(legacy.visibility, "official");
assert.equal(legacy.sourceScope, "past_paper");
assert.equal(legacy.resourceType, "past_paper");
assert.equal(isStudentVisibleSource(legacy), true, "legacy Past Papers rows visible in the tab must also be visible to AI inventory");

const hidden = canonicalizePastPaperSource({ id: "p2", title: "Hidden paper", published: false });
assert.equal(hidden.published, false);
assert.equal(isStudentVisibleSource(hidden), false);

assert.equal(inferResourceType({ title: "2024 ET", category: "Marking Schemes" }), "marking_scheme");
assert.equal(inferResourceType({ title: "ET Practice", category: "Model Papers" }), "model_paper");

console.log("Legacy Past Paper visibility tests passed.");
