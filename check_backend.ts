import "dotenv/config";
import { readUser } from "./server/data/userRepository";

async function run() {
  const user1 = readUser("26002ishan@gmail.com");
  const user2 = readUser("rmbeatsyt@gmail.com");
  console.log("26002ishan: ", user1?.data?.zScoreHistory?.length);
  console.log("rmbeatsyt: ", user2?.data?.zScoreHistory?.length);
  process.exit(0);
}
run();
