import re

with open("src/components/ui/SourceCard.tsx", "r") as f:
    c = f.read()

c = c.replace('variant="outline"', 'variant="secondary"')

with open("src/components/ui/SourceCard.tsx", "w") as f:
    f.write(c)
