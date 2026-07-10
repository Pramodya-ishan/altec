import re

with open("src/components/views/SyllabusLibraryView.tsx", "r") as f:
    c = f.read()

c = c.replace("setActiveFilter(tab)", "setActiveTab(tab)")
c = c.replace("activeFilter ===", "activeTab ===")

with open("src/components/views/SyllabusLibraryView.tsx", "w") as f:
    f.write(c)
