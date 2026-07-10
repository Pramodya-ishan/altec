import re

with open("server/rag/retrieve.ts", "r") as f:
    c = f.read()

c = c.replace('db.collection("ragChunks")', 'db.collection("rag_chunks")')
c = c.replace('db.collection("ragSources")', 'db.collection("rag_sources")')

with open("server/rag/retrieve.ts", "w") as f:
    f.write(c)
