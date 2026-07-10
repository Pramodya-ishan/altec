import re

with open("server/ai/respondStream.ts", "r") as f:
    c = f.read()

old_call = r'retrieveRelevantKnowledge\(\{\s*query: prompt,\s*uid: user\.uid,\s*subject: route\.entities\.subject \|\| activeSubject,\s*limit: 5\s*\}\)'
new_call = """retrieveRelevantKnowledge({
        prompt: prompt,
        activeSubject: route.entities.subject || activeSubject,
        mode: route.mode,
        limit: 5
      })"""

c = re.sub(old_call, new_call, c, flags=re.DOTALL)

with open("server/ai/respondStream.ts", "w") as f:
    f.write(c)
