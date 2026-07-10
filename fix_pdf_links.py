import re

with open("src/components/views/PastPapersView.tsx", "r") as f:
    c = f.read()

# Fix the click handler
old_click = r'onClick=\{\(\) => \{\s*if \(paper\.storagePath\) \{\s*openPrivateStoragePdf\(paper\.storagePath\)\.catch\(\(\) => \{\s*if \(paper\.url\) window\.open\(paper\.url, \'_blank\'\);\s*\}\);\s*\} else if \(paper\.url\) \{\s*window\.open\(paper\.url, \'_blank\'\);\s*\}\s*\}\}'

new_click = """onClick={() => {
    if (paper.url && paper.url.startsWith('http')) {
       window.open(paper.url, '_blank');
    } else if (paper.storagePath) {
      openPrivateStoragePdf(paper.storagePath).catch(() => {
        if (paper.url) window.open(paper.url, '_blank');
      });
    } else if (paper.url) {
      window.open(paper.url, '_blank');
    }
  }}"""

c = re.sub(old_click, new_click, c, flags=re.DOTALL)

with open("src/components/views/PastPapersView.tsx", "w") as f:
    f.write(c)
