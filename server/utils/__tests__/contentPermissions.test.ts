import assert from "node:assert/strict";
import {
  assertContentManager,
  isContentManager,
  isSharedSourceScope,
  isStudentVisibleSource,
} from "../contentPermissions";

assert.equal(isContentManager({ roles: ["admin"] }), true);
assert.equal(isContentManager({ roles: ["content_editor"] }), true);
assert.equal(isContentManager({ roles: ["teacher"] }), true);
assert.equal(isContentManager({ roles: ["ops"] }), true);
assert.equal(isContentManager({ roles: ["student"] }), false);
assert.equal(isContentManager(undefined), false);

for (const scope of ["paper_structure", "past_paper", "owner_syllabus", "shared_lesson", "official"]) {
  assert.equal(isSharedSourceScope(scope), true, `${scope} must be treated as shared content`);
}
assert.equal(isSharedSourceScope("chat_upload"), false);
assert.equal(isSharedSourceScope("personal"), false);

assert.equal(isStudentVisibleSource({ visibility: "public", published: true }), true);
assert.equal(isStudentVisibleSource({ visibility: "class" }), true);
assert.equal(isStudentVisibleSource({ visibility: "class", published: false }), false);
assert.equal(isStudentVisibleSource({ visibility: "private", sourceScope: "paper_structure" }), true);
assert.equal(isStudentVisibleSource({ visibility: "private", sourceScope: "past_paper", published: false }), false);
assert.equal(isStudentVisibleSource({ visibility: "private", sourceScope: "chat_upload" }), false);
assert.equal(isStudentVisibleSource({ visibility: "private", sourceScope: "personal" }), false);

assert.doesNotThrow(() => assertContentManager({ roles: ["teacher"] }));
assert.throws(
  () => assertContentManager({ roles: ["student"] }),
  (error: any) => error?.code === "CONTENT_MANAGER_REQUIRED" && error?.status === 403,
);

console.log("content permission tests passed");
