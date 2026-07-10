import re

with open("src/components/modals/NotesModal.tsx", "r") as f:
    c = f.read()

c = c.replace("import { openPrivateStoragePdf } from '../../lib/clientStorageUpload';", "import { openPrivateStoragePdf, uploadPdfWithClientStorage } from '../../lib/clientStorageUpload';")

with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(c)
