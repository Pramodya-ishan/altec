import re

with open("server/rag/retrieve.ts", "r") as f:
    c = f.read()

c = c.replace("export async function retrieveRelevantKnowledge(params: { prompt: string, activeSubject: string, mode: string, limit?: number }) {", "export async function retrieveRelevantKnowledge(params: { prompt: string, activeSubject: string, mode: string, limit?: number, uid?: string }) {")
c = c.replace("const { prompt, activeSubject, mode, limit = 6 } = params;", "const { prompt, activeSubject, mode, limit = 6, uid } = params;")

with open("server/rag/retrieve.ts", "w") as f:
    f.write(c)

with open("server/ai/respondStream.ts", "r") as f:
    r = f.read()

r = r.replace("activeSubject: route.entities.subject || activeSubject,\n        mode: route.mode,\n        limit: 5", "activeSubject: route.entities.subject || activeSubject,\n        mode: route.mode,\n        uid: user.uid,\n        limit: 5")

with open("server/ai/respondStream.ts", "w") as f:
    f.write(r)
