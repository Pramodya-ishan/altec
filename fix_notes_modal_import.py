import re

with open("src/components/modals/NotesModal.tsx", "r") as f:
    c = f.read()

# Add import
if "openPrivateStoragePdf" not in c[:300]:
    c = c.replace("import { apiFetch } from '../../lib/api';", "import { apiFetch } from '../../lib/api';\nimport { openPrivateStoragePdf } from '../../lib/clientStorageUpload';")

# Remove the empty local function
c = re.sub(r'const openPrivateStoragePdf = async \(path: string\) => \{.*?\};', '', c, flags=re.DOTALL)

with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(c)
