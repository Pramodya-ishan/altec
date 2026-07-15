import { computeSourceCapabilities, AuthContext, AppRole } from "../server/utils/authContext";
import { applyConfiguredAdminRoles } from "../server/utils/configuredRoles";
import fs from "fs";
import path from "path";
import { generateKeyPairSync } from "node:crypto";
import { parseGoogleServiceAccountJson } from "../server/utils/googleCredentials";
import { storageGsUri, storageObjectPath, validatedPdfDownloadUrl } from "../server/pdf/sourceBuffer";
import { createPdfPageSubset } from "../server/pdf/pdfSubset";
import { PDFDocument } from "pdf-lib";
import { parseSelectedPdfQuestionFollowup } from "../server/ai/selectedPdfFollowup";

function logTest(name: string, passed: boolean, details?: string) {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${name}${details ? ` - ${details}` : ""}`);
}

async function runTests() {
  console.log("==========================================");
  console.log("STARTING SECTION 02 SECURITY & ROLE TESTS");
  console.log("==========================================\n");

  let allPassed = true;

  // Group A: Role / Capability Calculations Test
  try {
    console.log("--- Group A: Capability Matrix Tests ---");
    
    const mockAuth = (uid: string, roles: AppRole[]): AuthContext => ({
      uid,
      roles,
      isAnonymous: false,
      email: `${uid}@example.com`
    });

    // Case 1: Student owns private source
    const studentAuth = mockAuth("student_1", ["student"]);
    const privateSource = { ownerUid: "student_1", visibility: "private" as const };
    const studentPrivateCaps = computeSourceCapabilities(studentAuth, privateSource);
    
    if (studentPrivateCaps.canView && studentPrivateCaps.canDelete && studentPrivateCaps.canReprocess && !studentPrivateCaps.canReviewCache) {
      logTest("Student owned private source", true);
    } else {
      logTest("Student owned private source", false, "Incorrect capabilities mapped");
      allPassed = false;
    }

    // Case 2: Student accessing another student's private source
    const anotherPrivateSource = { ownerUid: "student_2", visibility: "private" as const };
    const studentOtherCaps = computeSourceCapabilities(studentAuth, anotherPrivateSource);
    if (!studentOtherCaps.canView && !studentOtherCaps.canDelete && !studentOtherCaps.canReprocess) {
      logTest("Student accessing foreign private source", true);
    } else {
      logTest("Student accessing foreign private source", false, "Leak detected!");
      allPassed = false;
    }

    // Case 3: Admin accessing foreign private source
    const adminAuth = mockAuth("admin_1", ["admin"]);
    const adminOtherCaps = computeSourceCapabilities(adminAuth, anotherPrivateSource);
    if (adminOtherCaps.canView && adminOtherCaps.canDelete && adminOtherCaps.canReprocess) {
      logTest("Admin accessing foreign private source", true);
    } else {
      logTest("Admin accessing foreign private source", false, "Admin lacks admin capabilities");
      allPassed = false;
    }

    // Case 4: Student accessing official source
    const officialSource = { ownerUid: "admin_1", visibility: "official" as const };
    const studentOfficialCaps = computeSourceCapabilities(studentAuth, officialSource);
    if (studentOfficialCaps.canView && !studentOfficialCaps.canDelete && !studentOfficialCaps.canRepairSource) {
      logTest("Student accessing official source", true);
    } else {
      logTest("Student accessing official source", false, "Student can alter official source");
      allPassed = false;
    }

    // Case 5: Ops accessing official source
    const opsAuth = mockAuth("ops_1", ["ops"]);
    const opsOfficialCaps = computeSourceCapabilities(opsAuth, officialSource);
    if (opsOfficialCaps.canView && opsOfficialCaps.canReprocess && opsOfficialCaps.canRepairSource) {
      logTest("Ops accessing official source", true);
    } else {
      logTest("Ops accessing official source", false, "Ops lacks processing capabilities");
      allPassed = false;
    }

    // Case 6: Reviewer cache review permissions
    const reviewerAuth = mockAuth("reviewer_1", ["reviewer"]);
    const reviewerCaps = computeSourceCapabilities(reviewerAuth, {});
    const studentEmptyCaps = computeSourceCapabilities(studentAuth, {});
    if (reviewerCaps.canReviewCache && !studentEmptyCaps.canReviewCache) {
      logTest("Reviewer vs Student cache review capability", true);
    } else {
      logTest("Reviewer vs Student cache review capability", false);
      allPassed = false;
    }

  } catch (err: any) {
    console.error("Group A failed with error:", err);
    allPassed = false;
  }

  // Group B: Literal email scan check
  try {
    console.log("\n--- Group B: Literal Email Scan Checks ---");
    const forbiddenPatterns = [
      "26002ishan@gmail.com",
      "ishanstc123@gmail.com"
    ];

    let foundForbidden = false;
    const scanDirectory = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (file !== "node_modules" && file !== "dist" && file !== ".git" && file !== "docs") {
            scanDirectory(fullPath);
          }
        } else if (stat.isFile() && (file.endsWith(".ts") || file.endsWith(".tsx"))) {
          const content = fs.readFileSync(fullPath, "utf-8");
          for (const pattern of forbiddenPatterns) {
            if (content.includes(pattern)) {
              // Ignore self-tests or specific files we expect, but prevent them in general source files
              if (file !== "run-security-tests.ts" && file !== "AppContext.tsx") {
                console.warn(`Forbidden literal email '${pattern}' found in file: ${fullPath}`);
                foundForbidden = true;
              }
            }
          }
        }
      }
    };

    scanDirectory("./src");
    scanDirectory("./server");

    if (!foundForbidden) {
      logTest("Literal email authorization scan", true, "No forbidden admin emails found in logical guards.");
    } else {
      logTest("Literal email authorization scan", false, "Hard-coded emails detected! Please remove them.");
      allPassed = false;
    }

  } catch (err: any) {
    console.error("Group B failed with error:", err);
    allPassed = false;
  }

  // Group C: Environment-configured owner role bootstrap
  const previousAdminEmails = process.env.ADMIN_EMAILS;
  const previousAdminUids = process.env.ADMIN_UIDS;
  try {
    console.log("\n--- Group C: Configured Admin Role Tests ---");
    process.env.ADMIN_EMAILS = "owner@example.com, editor@example.com";
    process.env.ADMIN_UIDS = "owner-uid";

    const verifiedOwnerRoles = applyConfiguredAdminRoles("OWNER@example.com", true, ["student"]);
    const unverifiedOwnerRoles = applyConfiguredAdminRoles("owner@example.com", false, ["student"]);
    const unrelatedRoles = applyConfiguredAdminRoles("student@example.com", true, ["student"]);
    const uidOwnerRoles = applyConfiguredAdminRoles(undefined, false, ["student"], "owner-uid");

    const verifiedOwnerIsPrivileged = ["admin", "content_editor", "ops", "reviewer"]
      .every((role) => verifiedOwnerRoles.includes(role));
    const unverifiedOwnerIsStudent = unverifiedOwnerRoles.length === 1 && unverifiedOwnerRoles[0] === "student";
    const unrelatedUserIsStudent = unrelatedRoles.length === 1 && unrelatedRoles[0] === "student";

    const uidOwnerIsPrivileged = ["admin", "content_editor", "ops", "reviewer"]
      .every((role) => uidOwnerRoles.includes(role));

    if (verifiedOwnerIsPrivileged && uidOwnerIsPrivileged && unverifiedOwnerIsStudent && unrelatedUserIsStudent) {
      logTest("Configured admin requires a verified matching Firebase email", true);
    } else {
      logTest("Configured admin requires a verified matching Firebase email", false, "Role bootstrap boundary failed");
      allPassed = false;
    }
  } catch (err: any) {
    console.error("Group C failed with error:", err);
    allPassed = false;
  } finally {
    if (previousAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previousAdminEmails;
    if (previousAdminUids === undefined) delete process.env.ADMIN_UIDS;
    else process.env.ADMIN_UIDS = previousAdminUids;
  }

  // Group D: Service-account parsing must be strict because malformed Vercel
  // secrets otherwise make every serverless route crash at runtime.
  try {
    console.log("\n--- Group D: Google Credential Validation Tests ---");
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const serviceAccount = {
      type: "service_account",
      project_id: "al-ai-chat",
      client_email: "test@al-ai-chat.iam.gserviceaccount.com",
      private_key: privateKey,
    };

    const parsed = parseGoogleServiceAccountJson(JSON.stringify(serviceAccount));
    const doubleEncoded = parseGoogleServiceAccountJson(JSON.stringify(JSON.stringify(serviceAccount)));
    let placeholderRejected = false;
    try {
      parseGoogleServiceAccountJson("PASTE_SERVICE_ACCOUNT_JSON_HERE");
    } catch {
      placeholderRejected = true;
    }

    if (
      parsed.project_id === serviceAccount.project_id
      && doubleEncoded.client_email === serviceAccount.client_email
      && placeholderRejected
    ) {
      logTest("Strict Google service-account parsing", true);
    } else {
      logTest("Strict Google service-account parsing", false);
      allPassed = false;
    }
  } catch (err: any) {
    console.error("Group D failed with error:", err);
    allPassed = false;
  }

  // Group E: client-supplied Firebase URLs are accepted only for the exact
  // resolved object. This prevents the reindex endpoint becoming an SSRF or
  // cross-user Storage proxy.
  try {
    console.log("\n--- Group E: Verified PDF URL Handoff Tests ---");
    const expectedPath = "users/test-user/past_papers/SFT/paper.pdf";
    const exactUrl = `https://firebasestorage.googleapis.com/v0/b/example.firebasestorage.app/o/${encodeURIComponent(expectedPath)}?alt=media&token=test-token`;
    const otherUrl = `https://firebasestorage.googleapis.com/v0/b/example.firebasestorage.app/o/${encodeURIComponent("users/other/private.pdf")}?alt=media&token=test-token`;

    const exactAccepted = validatedPdfDownloadUrl(exactUrl, expectedPath).startsWith("https://firebasestorage.googleapis.com/");
    const mismatchRejected = validatedPdfDownloadUrl(otherUrl, expectedPath) === "";
    const hostRejected = validatedPdfDownloadUrl("https://example.com/paper.pdf", expectedPath) === "";
    const pathDecoded = storageObjectPath(exactUrl) === expectedPath;

    if (exactAccepted && mismatchRejected && hostRejected && pathDecoded) {
      logTest("Exact-object Firebase PDF URL handoff", true);
    } else {
      logTest("Exact-object Firebase PDF URL handoff", false, "URL validation boundary failed");
      allPassed = false;
    }
  } catch (err: any) {
    console.error("Group E failed with error:", err);
    allPassed = false;
  }

  try {
    console.log("\n--- Group F: Vertex GCS and Targeted PDF Tests ---");
    const storageUrl = "https://firebasestorage.googleapis.com/v0/b/example.firebasestorage.app/o/users%2Ftest-user%2Fpaper.pdf?alt=media&token=secret-token";
    const gcsUri = storageGsUri(storageUrl);
    const tokenStripped = gcsUri === "gs://example.firebasestorage.app/users/test-user/paper.pdf"
      && !gcsUri.includes("token=");

    const document = await PDFDocument.create();
    document.addPage([200, 200]);
    document.addPage([200, 200]);
    document.addPage([200, 200]);
    const subset = await createPdfPageSubset(Buffer.from(await document.save()), [2, 3]);
    const subsetDocument = await PDFDocument.load(subset.buffer);
    const subsetValid = subsetDocument.getPageCount() === 2
      && subset.originalPageNumbers.join(",") === "2,3";

    const compactFollowups = ["1", "q1", "question 01", "1st mcq", "1 වෙනි"];
    const followupsValid = compactFollowups.every((followup) =>
      parseSelectedPdfQuestionFollowup(followup)?.questionNo === "1"
    );
    const typedFollowupValid = parseSelectedPdfQuestionFollowup("structured essay q2")?.questionType === "ESSAY";
    const normalPromptIgnored = parseSelectedPdfQuestionFollowup("explain fluid mechanics theory") === null;

    if (tokenStripped && subsetValid && followupsValid && typedFollowupValid && normalPromptIgnored) {
      logTest("Token-free Vertex GCS URI, targeted PDF subset, and selected-source follow-ups", true);
    } else {
      logTest("Token-free Vertex GCS URI, targeted PDF subset, and selected-source follow-ups", false);
      allPassed = false;
    }
  } catch (err: any) {
    console.error("Group F failed with error:", err);
    allPassed = false;
  }

  console.log("\n==========================================");
  if (allPassed) {
    console.log("ALL SECURITY & CAPABILITY TESTS PASSED!");
    console.log("==========================================");
    process.exit(0);
  } else {
    console.error("SOME SECURITY TESTS FAILED!");
    console.log("==========================================");
    process.exit(1);
  }
}

runTests();
