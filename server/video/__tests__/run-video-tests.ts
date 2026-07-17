import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.VIDEO_CDN_BASE_URL = "https://video.example.com";
process.env.VIDEO_CDN_KEY_NAME = "test-key";
process.env.VIDEO_CDN_SIGNING_KEY = Buffer.from("0123456789abcdef").toString("base64url");
process.env.VIDEO_COOKIE_TTL_SECONDS = "300";

const { canUserPlayVideo, createSignedPlaybackCookie, safeVideoFileName, normalizeRepeatedFileExtension } = await import("../videoService");

const baseVideo = {
  id: "video_123",
  sourceId: "source_123",
  title: "Lesson",
  status: "ready" as const,
  visibility: "class" as const,
  allowedRoles: [] as string[],
  allowedUserIds: [] as string[],
  inputBucket: "input",
  inputObjectPath: "source/video.mp4",
  hlsPrefix: "videos/video_123/versions/2/hls/",
  masterManifestPath: "videos/video_123/versions/2/hls/master.m3u8",
  sourceSizeBytes: 1024,
  mimeType: "video/mp4",
  createdBy: "admin",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  isPublished: true,
  allowPlayback: true,
  watermarkEnabled: true,
  maxConcurrentSessions: 1,
  qualityProfiles: ["360p", "720p"],
  version: 2,
};

assert.equal(safeVideoFileName("lesson 01 (final).mp4"), "lesson_01_final_.mp4");
assert.equal(normalizeRepeatedFileExtension("lesson.mp4.mp4"), "lesson.mp4");
assert.equal(safeVideoFileName("lesson.mp4.mp4"), "lesson.mp4");
assert.equal(canUserPlayVideo(baseVideo, { uid: "student", roles: ["student"] }), true);
assert.equal(canUserPlayVideo({ ...baseVideo, visibility: "private" }, { uid: "student", roles: ["student"] }), false);
assert.equal(canUserPlayVideo({ ...baseVideo, visibility: "private", allowedRoles: ["teacher"] }, { uid: "teacher", roles: ["teacher"] }), true);
assert.equal(canUserPlayVideo({ ...baseVideo, isPublished: false }, { uid: "student", roles: ["student"] }), false);
assert.equal(canUserPlayVideo({ ...baseVideo, isPublished: false }, { uid: "admin", admin: true, roles: ["admin"] }), true);

const before = Date.now();
const signed = createSignedPlaybackCookie(baseVideo);
assert.equal(signed.manifestUrl, "https://video.example.com/videos/video_123/versions/2/hls/master.m3u8");
assert.equal(signed.path, "/videos/video_123/versions/2/hls/");
assert.match(signed.cookieValue, /^URLPrefix=.*:Expires=\d+:KeyName=test-key:Signature=/);
const ttlMs = new Date(signed.expiresAt).getTime() - before;
assert(ttlMs >= 299_000 && ttlMs <= 301_000, `Unexpected signed-cookie TTL: ${ttlMs}`);

console.log("ALL SECURE VIDEO TESTS PASSED!");
