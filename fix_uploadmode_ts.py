import re

with open("src/lib/uploadMode.ts", "r") as f:
    c = f.read()

c = c.replace("return cachedMode;", "return cachedMode as any;")
c = c.replace("return await fetchPromise;", "return (await fetchPromise) as any;")

with open("src/lib/uploadMode.ts", "w") as f:
    f.write(c)
