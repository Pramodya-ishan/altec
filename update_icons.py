import re

file_path = "src/components/views/AdmissionPredictorView.tsx"

with open(file_path, "r") as f:
    content = f.read()

replacements = {
    r'<i className="fa-solid fa-graduation-cap text-9xl text-white"></i>': r'<GraduationCap className="w-24 h-24 text-white" />',
    r'<i className="fa-solid fa-chart-line text-sm"></i>': r'<LineChart className="w-4 h-4" />',
    r'<i className="fa-solid fa-arrow-trend-up text-indigo-500"></i>': r'<TrendingUp className="w-5 h-5 text-indigo-500" />',
    r'<i className="fa-solid fa-arrow-right"></i>': r'<ArrowRight className="w-4 h-4" />',
    r'<i className="fa-solid fa-bed text-indigo-500"></i>': r'<Bed className="w-5 h-5 text-indigo-500" />',
    r'<i className="fa-solid fa-bullseye text-rose-500"></i>': r'<Target className="w-5 h-5 text-rose-500" />',
    r'<i className="fa-solid fa-rocket text-4xl"></i>': r'<Rocket className="w-10 h-10" />',
    r'<i className="fa-solid fa-quote-left text-sm"></i>': r'<Quote className="w-4 h-4" />',
    r'<i className="fa-regular fa-square-check text-indigo-400 text-sm"></i>': r'<CheckSquare className="w-4 h-4 text-indigo-400" />',
    r'<i className="fa-solid fa-bolt text-amber-500"></i>': r'<Zap className="w-5 h-5 text-amber-500" />',
    r'<i className="fa-solid fa-clock text-indigo-500"></i>': r'<Clock className="w-5 h-5 text-indigo-500" />',
    r'<i className="fa-solid fa-book-open fill-rose-500"></i>': r'<BookOpen className="w-5 h-5 text-rose-500" />',
    r'<i className="fa-solid fa-circle-notch fa-spin text-lg"></i>': r'<Loader2 className="w-5 h-5 animate-spin" />',
    r'<i className="fa-solid fa-triangle-exclamation"></i>': r'<AlertTriangle className="w-4 h-4" />',
    r'<i className="fa-solid fa-database text-primary-500"></i>': r'<Database className="w-5 h-5 text-primary-500" />',
    r'<i className="fa-solid fa-chart-line text-4xl text-indigo-900"></i>': r'<LineChart className="w-10 h-10 text-indigo-900" />',
    r'<i className="fa-solid fa-map-location-dot text-4xl text-emerald-900"></i>': r'<MapPin className="w-10 h-10 text-emerald-900" />',
    r'<i className="fa-solid fa-earth-americas text-4xl text-amber-900"></i>': r'<Globe className="w-10 h-10 text-amber-900" />',
    r'<i className="fa-solid fa-chart-line text-primary-500"></i>': r'<LineChart className="w-5 h-5 text-primary-500" />',
    r'<i className="fa-solid fa-brain text-base"></i>': r'<Brain className="w-4 h-4" />',
    r'<i className="fa-solid fa-copy"></i>': r'<Copy className="w-4 h-4" />',
    r'<i className="fa-solid fa-arrow-up-right-from-square"></i>': r'<ExternalLink className="w-4 h-4" />',
    r'<i className="fa-solid fa-copy text-2xl"></i>': r'<Copy className="w-6 h-6" />',
    r'<i className="fa-solid fa-arrow-up-right-from-square text-2xl"></i>': r'<ExternalLink className="w-6 h-6" />',
    r'<i className="fa-solid fa-graduation-cap text-base"></i>': r'<GraduationCap className="w-4 h-4" />',
    r'<i className={confirmClearChat \? "fa-solid fa-triangle-exclamation" : "fa-solid fa-trash-can"}></i>': r'{confirmClearChat ? <AlertTriangle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}',
    r'<i className="fa-solid fa-circle-exclamation text-rose-500 mt-0.5"></i>': r'<AlertCircle className="w-4 h-4 text-rose-500 mt-0.5" />',
    r'<i className="fa-solid fa-sparkles text-white text-\[15px\]"></i>': r'<Sparkles className="w-4 h-4 text-white" />',
    r'<i className="fa-solid fa-user text-slate-400 text-\[15px\]"></i>': r'<User className="w-4 h-4 text-slate-400" />',
    r'<i className="fa-regular fa-copy"></i>': r'<Copy className="w-4 h-4" />',
    r'<i className="fa-regular fa-thumbs-up"></i>': r'<ThumbsUp className="w-4 h-4" />',
    r'<i className="fa-regular fa-thumbs-down"></i>': r'<ThumbsDown className="w-4 h-4" />',
    r'<i className="fa-solid fa-sparkles text-\[10px\] text-slate-400"></i>': r'<Sparkles className="w-3 h-3 text-slate-400" />',
    r'<i className="fa-solid fa-arrow-up text-xs font-black"></i>': r'<ArrowUp className="w-3 h-3 font-black" />',
    r'<i className="fa-solid fa-calculator text-primary-600"></i>': r'<Calculator className="w-5 h-5 text-primary-600" />',
    r'<i className="fa-solid fa-fire text-indigo-600 animate-pulse"></i>': r'<Flame className="w-5 h-5 text-indigo-600 animate-pulse" />',
    r'<i className="fa-solid fa-fire text-amber-500 animate-pulse"></i>': r'<Flame className="w-5 h-5 text-amber-500 animate-pulse" />',
}

for old, new_icon in replacements.items():
    content = re.sub(old, new_icon, content)

# Also add import for lucide-react if missing
lucide_import = "import { GraduationCap, LineChart, TrendingUp, ArrowRight, Bed, Target, Rocket, Quote, CheckSquare, Zap, Clock, BookOpen, Loader2, AlertTriangle, Database, MapPin, Globe, Brain, Copy, ExternalLink, Trash2, AlertCircle, Sparkles, User, ThumbsUp, ThumbsDown, ArrowUp, Calculator, Flame } from 'lucide-react';"
if "from 'lucide-react'" not in content:
    content = content.replace("import React,", lucide_import + "\nimport React,")
else:
    # Let's just blindly add missing imports using a regex to merge them
    pass # Wait, better to manually update imports via edit_file

with open(file_path, "w") as f:
    f.write(content)
