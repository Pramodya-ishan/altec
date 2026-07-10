with open("src/components/modals/NotesModal.tsx", "r") as f:
    lines = f.readlines()

# find the last `)}` inside `<div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={contentRef}>`
# It should be around line 375.
# Let's just remove the first `)}` that appears alone on a line right before `</div>` at the end of the file.

out = []
for line in lines:
    if line.strip() == ")}":
        # Check context? We can just skip it if it's right before `</div>` 
        pass
out = "".join([l for l in lines if l.strip() != ")}"])
with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(out)
