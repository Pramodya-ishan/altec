with open("src/components/layout/Sidebar.tsx", "r") as f:
    c = f.read()

import re
old_div = r'<div className="p-4 border-t border-slate-100 bg-slate-50/50">.*?</div>\s*</aside>'
c = re.sub(old_div, '</aside>', c, flags=re.DOTALL)

with open("src/components/layout/Sidebar.tsx", "w") as f:
    f.write(c)
