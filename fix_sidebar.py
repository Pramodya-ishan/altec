import re

with open("src/components/layout/Sidebar.tsx", "r") as f:
    c = f.read()

# Settings icon is imported but not used anymore (which is fine). 
# Wait, let me remove Settings from the imports just to avoid TS/lint warnings.
c = c.replace("  Settings,\n", "")

with open("src/components/layout/Sidebar.tsx", "w") as f:
    f.write(c)
