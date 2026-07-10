import re

with open("src/components/modals/NotesModal.tsx", "r") as f:
    c = f.read()

# Change saving logic
old_push = r'nextData\[currentSubject\]\.topics\[topic\]\.videos\.push\(\{\s*title: file\.name,\s*url: dataJson\.sourceId, // Store sourceId instead of url, the click handler uses sourceId\s*type: file\.type\s*\}\);'
new_push = """nextData[currentSubject].topics[topic].videos.push({
        title: file.name,
        url: dataJson.sourceId,
        storagePath: dataJson.storagePath,
        type: file.type
      });"""

c = re.sub(old_push, new_push, c)

# Change rendering logic
old_click = r"onClick=\{\(e\) => \{\s*if \(vid\.url && !vid\.url\.startsWith\('http'\)\) \{\s*e\.preventDefault\(\);\s*// Use fallback api if needed, though they should be http now\.\s*\}\s*\}\}"
new_click = """onClick={(e) => {
                          if (vid.url && !vid.url.startsWith('http')) {
                             e.preventDefault();
                             if (vid.storagePath) {
                               openPrivateStoragePdf(vid.storagePath).catch(() => alert('Failed to open PDF'));
                             }
                          }
                        }}"""
c = re.sub(old_click, new_click, c)

with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(c)
