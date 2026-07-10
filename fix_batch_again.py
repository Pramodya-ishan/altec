import re

with open("server/syllabus/routes.ts", "r") as f:
    c = f.read()

# It looks like the regex replace didn't work because it had different whitespace. Let's do it simply.
c = c.replace("    if (docSnap.exists) {", "    const batch = db.batch();\n    if (docSnap.exists) {")
c = c.replace("    const batch = db.batch();\n    chunksSnap.docs.forEach((d: any) => batch.delete(d.ref));", "    chunksSnap.docs.forEach((d: any) => batch.delete(d.ref));")


with open("server/syllabus/routes.ts", "w") as f:
    f.write(c)
