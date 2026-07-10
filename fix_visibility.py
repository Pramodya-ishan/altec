import re

with open("server/rag/routes.ts", "r") as f:
    c = f.read()

# Replace visibility: "private" with dynamic
old_vis = r'visibility: "private",'
new_vis = r'visibility: sourceScope === "owner_syllabus" ? "official" : "private",'

c = re.sub(old_vis, new_vis, c)

with open("server/rag/routes.ts", "w") as f:
    f.write(c)
