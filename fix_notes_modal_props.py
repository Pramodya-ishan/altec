import re

with open("src/components/modals/NotesModal.tsx", "r") as f:
    c = f.read()

c = c.replace("export function NotesModal({ topic, close }: { topic: string; close: () => void }) {", "export function NotesModal() {")

# Find where data, saveData is destructured, and add modals, setModals
c = re.sub(
    r'const \{ data, saveData, currentSubject \} = useApp\(\);',
    'const { data, saveData, currentSubject, modals, setModals } = useApp();\n  const topic = modals.playlist.topic;\n  const close = () => setModals(prev => ({ ...prev, playlist: { open: false, topic: "" } }));\n  if (!modals.playlist.open) return null;',
    c
)

with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(c)
