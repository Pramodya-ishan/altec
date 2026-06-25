import "dotenv/config";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const users = await db.collection("users").get();
  users.forEach(doc => {
    console.log(doc.id);
  });
  process.exit(0);
}
run();
