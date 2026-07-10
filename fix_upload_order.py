import re

files = [
    "src/components/views/SyllabusLibraryView.tsx",
    "src/components/views/PastPapersView.tsx"
]

for file in files:
    with open(file, "r") as f:
        c = f.read()

    # Find the ingestFd block
    c = c.replace(
        'ingestFd.append("file", file);',
        '// file appended later'
    )
    c = c.replace(
        'ingestFd.append("medium", form.medium || "Sinhala");',
        'ingestFd.append("medium", form.medium || "Sinhala");\n        ingestFd.append("file", file);'
    )
    c = c.replace(
        'ingestFd.append("medium", "Sinhala");',
        'ingestFd.append("medium", "Sinhala");\n        ingestFd.append("file", file);'
    )

    with open(file, "w") as f:
        f.write(c)

