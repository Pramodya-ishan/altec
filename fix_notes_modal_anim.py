import re

with open("src/components/modals/NotesModal.tsx", "r") as f:
    c = f.read()

# Add AnimatePresence import
if "AnimatePresence" not in c:
    c = c.replace("import { motion } from 'motion/react';", "import { motion, AnimatePresence } from 'motion/react';")

old_return = r'''  if \(!modals\.playlist\.open\) return null;

  const \[isUploading, setIsUploading\] = useState\(false\);'''

new_return = '''  const [isUploading, setIsUploading] = useState(false);'''

c = re.sub(old_return, new_return, c)

old_jsx = r'''    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm sm:p-6">
      <motion\.div'''

new_jsx = '''    <AnimatePresence>
      {modals.playlist.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm sm:p-6"
        >
          <motion.div'''

c = re.sub(old_jsx, new_jsx, c)

c = c.replace("      </motion.div>\n    </div>\n  );\n}", "          </motion.div>\n        </motion.div>\n      )}\n    </AnimatePresence>\n  );\n}")

with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(c)
