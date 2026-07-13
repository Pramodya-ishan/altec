import { SourceRepository } from "../sourceRepository";
import { AuthContext } from "../../utils/authContext";

async function runTests() {
  console.log("==========================================");
  console.log("STARTING PART 03B REPOSITORY TESTS");
  console.log("==========================================\n");

  let allPassed = true;

  const mockAuth = (uid: string, roles: string[]): AuthContext => ({
    uid,
    roles: roles as any,
    isAnonymous: false,
    email: `${uid}@example.com`
  });

  const student1 = mockAuth("user_1", ["student"]);
  const student2 = mockAuth("user_2", ["student"]);
  const admin1 = mockAuth("admin_1", ["admin"]);

  // Test 1: Authorization Logic (Pure check)
  try {
    const source: any = { sourceId: "s1", ownerUid: "user_1", visibility: "private" };
    
    // @ts-ignore - accessing private static for test
    const canOwnerView = SourceRepository["isAuthorized"](student1, source, "view");
    // @ts-ignore
    const canOtherView = SourceRepository["isAuthorized"](student2, source, "view");
    // @ts-ignore
    const canAdminView = SourceRepository["isAuthorized"](admin1, source, "view");

    if (canOwnerView && !canOtherView && canAdminView) {
      console.log("[PASS] Private source authorization");
    } else {
      console.error("[FAIL] Private source authorization", { canOwnerView, canOtherView, canAdminView });
      allPassed = false;
    }
  } catch (err) {
    console.error("[ERROR] Test 1 failed", err);
    allPassed = false;
  }

  // Test 2: Legacy Converters
  try {
    const legacyRag = { name: "Test RAG", fileName: "test.pdf", uploadedByUid: "u1", isPublic: true };
    // @ts-ignore
    const converted = SourceRepository["legacyConverters"].rag_sources("id1", legacyRag);
    
    if (converted.displayTitle === "Test RAG" && converted.visibility === "public" && converted.ownerUid === "u1") {
      console.log("[PASS] Legacy RAG converter");
    } else {
      console.error("[FAIL] Legacy RAG converter", converted);
      allPassed = false;
    }
  } catch (err) {
    console.error("[ERROR] Test 2 failed", err);
    allPassed = false;
  }

  console.log("\n==========================================");
  if (allPassed) {
    console.log("ALL PART 03B REPOSITORY TESTS PASSED!");
    process.exit(0);
  } else {
    console.error("SOME PART 03B REPOSITORY TESTS FAILED!");
    process.exit(1);
  }
}

runTests();
