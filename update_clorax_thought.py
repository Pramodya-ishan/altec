import re

with open("src/components/views/CloraXView.tsx", "r") as f:
    c = f.read()

# 1. Remove Assistant Avatar
avatar_regex = r'\{\/\* Assistant Avatar \*\/\}\s*\{\!isUser && \(\s*<div className="w-10 h-10 rounded-2xl bg-gradient-[^>]+>\s*<Sparkles[^>]+>\s*</div>\s*\)\}'
c = re.sub(avatar_regex, '', c, flags=re.DOTALL)

# 2. Change thought process container background to white and remove outline
old_thought_container = r'<div className="flex flex-col gap-2 bg-\[#f3f6fc\]/80 border border-slate-200/80 rounded-2xl p-4 shadow-xs">'
new_thought_container = r'<div className="flex flex-col gap-2 bg-white rounded-2xl">'
c = re.sub(old_thought_container, new_thought_container, c)

# 3. Remove the toggle button
toggle_regex = r'\{msg\.summary && msg\.summary\.length > 0 && \(\s*<button\s*onClick=\{\(\) => setSummaryExpanded\(\!summaryExpanded\)\}\s*className="text-\[10px\] font-bold text-slate-400 hover:text-slate-600 uppercase flex items-center gap-0\.5"\s*>\s*<span>\{summaryExpanded \? \'Hide\' : \'Show\'\}</span>\s*<ChevronDown[^>]+>\s*</button>\s*\)\}'
c = re.sub(toggle_regex, '', c, flags=re.DOTALL)

with open("src/components/views/CloraXView.tsx", "w") as f:
    f.write(c)
