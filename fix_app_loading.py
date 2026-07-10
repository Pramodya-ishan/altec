import re

with open("src/App.tsx", "r") as f:
    c = f.read()

# Replace the text with just a simple loader or nothing? "remove Loading Workspace... Syncing your progress"
c = c.replace('<h2 className="text-lg font-bold text-slate-900">Loading Workspace...</h2>', '')
c = c.replace('<p className="text-sm font-semibold text-slate-500">Syncing your progress...</p>', '')

with open("src/App.tsx", "w") as f:
    f.write(c)
