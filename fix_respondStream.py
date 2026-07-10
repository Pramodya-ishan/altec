import re

with open("server/ai/respondStream.ts", "r") as f:
    c = f.read()

# Change it back to query, uid, subject
old_call = r'retrieveRelevantKnowledge\(\{\s*prompt: prompt,\s*activeSubject: route\.entities\.subject \|\| activeSubject,\s*mode: route\.mode,\s*uid: user\.uid,\s*limit: 5\s*\}\)'

new_call = """retrieveRelevantKnowledge({
        query: prompt,
        uid: user.uid,
        subject: route.entities.subject || activeSubject,
        limit: 5
      })"""

c = re.sub(old_call, new_call, c, flags=re.DOTALL)

with open("server/ai/respondStream.ts", "w") as f:
    f.write(c)
