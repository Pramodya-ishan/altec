import re

with open("src/App.tsx", "r") as f:
    c = f.read()

# Replace auth loading popup
old_loading = r'if \(isAuthLoading\) \{.*?return \(\n\s*<div className="fixed inset-0.*?Syncing your progress.*?</div>\n\s*\);\n\s*\}'
new_loading = 'if (isAuthLoading) return null;'

c = re.sub(old_loading, new_loading, c, flags=re.DOTALL)

with open("src/App.tsx", "w") as f:
    f.write(c)
