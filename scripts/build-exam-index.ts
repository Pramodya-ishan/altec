import { buildExamIndex } from "../server/ai-core/pdf/indexing";
const result = await buildExamIndex();
console.log(JSON.stringify(result, null, 2));
