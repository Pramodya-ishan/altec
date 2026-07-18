import assert from "node:assert/strict";
import { validateFileSignature, validatePersonalAssistantFile } from "../uploadValidation";

function file(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

async function expectReject(promise: Promise<unknown>) {
  let rejected = false;
  try { await promise; } catch { rejected = true; }
  assert.equal(rejected, true);
}

async function run() {
  const pdf = file([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], "paper.pdf", "application/pdf");
  const png = file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image.png", "image/png");
  const jpg = file([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "image.jpg", "image/jpeg");
  const webp = file([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "image.webp", "image/webp");

  for (const item of [pdf, png, jpg, webp]) {
    validatePersonalAssistantFile(item);
    await validateFileSignature(item);
  }

  await expectReject(validateFileSignature(file([1, 2, 3, 4, 5], "fake.pdf", "application/pdf")));
  await expectReject(validateFileSignature(file([0x3c, 0x73, 0x76, 0x67], "fake.png", "image/png")));
  console.log("[PASS] Upload MIME and magic-byte validation");
}

void run();
