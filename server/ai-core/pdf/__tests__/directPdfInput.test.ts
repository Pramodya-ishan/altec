import assert from "node:assert/strict";
import { createDirectPdfInputPart } from "../directPdfQa";

const uri = "gs://example-bucket/users/u/source.pdf";
assert.deepEqual(createDirectPdfInputPart(undefined, uri), {
  fileData: { mimeType: "application/pdf", fileUri: uri },
});

const inline = createDirectPdfInputPart(Buffer.from("%PDF-test")) as any;
assert.equal(inline.inlineData.mimeType, "application/pdf");
assert.equal(Buffer.from(inline.inlineData.data, "base64").toString(), "%PDF-test");
assert.equal(createDirectPdfInputPart(), null);

console.log("Direct PDF input tests passed");
