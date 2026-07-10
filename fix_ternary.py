with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

# Replace `{isEmptyChat ? ( ) : ( ` with just `{isEmptyChat ? null : (`
# Wait, `c = c.replace("{isEmptyChat ? (\n\n              ) : (", "{isEmptyChat ? null : (")`
import re
c = re.sub(r'\{isEmptyChat \? \(\s*\) : \(', '{isEmptyChat ? null : (', c)

with open("src/components/views/CloraXView.tsx", "w") as f:
    f.write(c)
