import re

with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

start_marker = "{/* Workflow Chips & Reasoning Log */}"
end_marker = "{/* Markdown Answer Area */}"

start_idx = c.find(start_marker)
end_idx = c.find(end_marker)

if start_idx != -1 and end_idx != -1:
    before = c[:start_idx + len(start_marker)]
    after = c[end_idx:]
    
    new_jsx = """
                            <ThoughtProcessPanel msg={msg} isStreamingActive={isStreamingActive} status={status} tools={tools} />
                            """
    
    c = before + new_jsx + after
    
    with open("src/components/views/CloraXView.tsx", "w") as f:
        f.write(c)
    print("Replaced!")
else:
    print("Not found")

