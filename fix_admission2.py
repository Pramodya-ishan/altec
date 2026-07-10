import re

with open("src/components/views/AdmissionPredictorView.tsx", "r") as f:
    c = f.read()

# Add a simple loader instead of being completely empty
loader_html = """<div className="py-12 flex flex-col items-center justify-center space-y-6 bg-white border-0">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>"""

c = c.replace('<div className="py-12 flex flex-col items-center justify-center space-y-6 bg-white border-0">\n          \n        </div>', loader_html)

with open("src/components/views/AdmissionPredictorView.tsx", "w") as f:
    f.write(c)
