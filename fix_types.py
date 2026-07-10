import re

with open("src/types.ts", "r") as f:
    c = f.read()

c = c.replace("export type Video = { url: string; title: string; type?: string; };", "export type Video = { url: string; title: string; type?: string; storagePath?: string; };")

with open("src/types.ts", "w") as f:
    f.write(c)
