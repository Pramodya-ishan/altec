import { env } from "../server/utils/env";
import { getAdminBucketByName } from "../server/firebase/admin";

const configuredOrigins = String(process.env.VIDEO_ALLOWED_ORIGINS || "https://tecal.vercel.app")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

async function main() {
  const bucketName = env.VIDEO_INPUT_BUCKET;
  if (!bucketName) throw new Error("VIDEO_INPUT_BUCKET is required.");
  const bucket = getAdminBucketByName(bucketName);
  await bucket.setCorsConfiguration([
    {
      origin: configuredOrigins,
      method: ["GET", "HEAD", "PUT", "POST", "OPTIONS"],
      responseHeader: ["Content-Type", "Content-Length", "Content-Range", "Range", "ETag", "x-goog-resumable"],
      maxAgeSeconds: 3600,
    },
  ]);
  console.log(JSON.stringify({ ok: true, bucket: bucketName, origins: configuredOrigins }, null, 2));
}

main().catch((error) => {
  console.error("Video bucket CORS configuration failed", error);
  process.exitCode = 1;
});
