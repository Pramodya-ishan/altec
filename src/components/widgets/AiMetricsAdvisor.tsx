import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { apiFetch } from "../../lib/api";
import { SSEParser } from "../../lib/sseParser";
import { getEstIslandRank, getEstDistrictRank, calculateSubjectZ } from "../../lib/scoreUtils";
import ReactMarkdown from "react-markdown";
import { 
  Sparkles, 
  MapPin, 
  GraduationCap, 
  AlertCircle, 
  Loader2, 
  Send, 
  ChevronRight, 
  TrendingUp, 
  Award,
  Zap,
  ArrowRight,
  BookOpen
} from "lucide-react";

// List of Sri Lankan Districts for localized AI rank & course suggestions
const SRI_LANKA_DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", 
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar", 
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee", 
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", 
  "Moneragala", "Ratnapura", "Kegalle"
];

const POPULAR_COURSES = [
  { value: "engineering_tech", label: "Engineering Technology (ET)" },
  { value: "biosystems_tech", label: "Biosystems Technology (BST)" },
  { value: "ict", label: "Information & Communication Technology (BICT)" },
  { value: "qs", label: "Quantity Surveying (QS)" },
  { value: "app_science", label: "Applied Sciences (Physical/Computer Science)" }
];

export function AiMetricsAdvisor({
  sftMark,
  etMark,
  ictMark,
  overallZ,
  targetZ
}: {
  sftMark: number;
  etMark: number;
  ictMark: number;
  overallZ: number;
  targetZ: number;
}) {
  const { currentSubject } = useApp();
  const [district, setDistrict] = useState(() => {
    return localStorage.getItem("al_advisor_district") || "Colombo";
  });
  const [preferredCourse, setPreferredCourse] = useState(() => {
    return localStorage.getItem("al_advisor_course") || "engineering_tech";
  });

  const [loading, setLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [error, setError] = useState("");
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "model"; text: string }>>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("al_advisor_district", district);
  }, [district]);

  useEffect(() => {
    localStorage.setItem("al_advisor_course", preferredCourse);
  }, [preferredCourse]);

  const sftZ = calculateSubjectZ("sft", sftMark);
  const etZ = calculateSubjectZ("et", etMark);
  const ictZ = calculateSubjectZ("ict", ictMark);

  const getDistrictRank = getEstDistrictRank(overallZ);
  const getIslandRank = getEstIslandRank(overallZ);

  const runAiAnalysis = async (customPrompt?: string) => {
    setLoading(true);
    setError("");
    setAnalysisText("");

    const targetCourseLabel = POPULAR_COURSES.find(c => c.value === preferredCourse)?.label || preferredCourse;

    const systemPrompt = customPrompt ? customPrompt : `
Provide a comprehensive A/L Technology Stream AI prediction and rank advisory based on my active scores:

**STUDENT PROFILE METRICS**:
- Science for Technology (SFT) Mark: ${sftMark.toFixed(1)}% (Subject Z: ${sftZ >= 0 ? "+" : ""}${sftZ.toFixed(3)})
- Engineering Technology (ET) Mark: ${etMark.toFixed(1)}% (Subject Z: ${etZ >= 0 ? "+" : ""}${etZ.toFixed(3)})
- Information & Communication Technology (ICT) Mark: ${ictMark.toFixed(1)}% (Subject Z: ${ictZ >= 0 ? "+" : ""}${ictZ.toFixed(3)})
- Calculated Overall Z-Score: ${overallZ >= 0 ? "+" : ""}${overallZ.toFixed(4)}
- Estimated Island Rank: ${getIslandRank}
- Estimated District Rank: ${getDistrictRank} in ${district} district
- Target Z-Score: +${targetZ.toFixed(2)}
- Preferred Degree Pathway: ${targetCourseLabel}

**AI PROMPT / TASK**:
Analyze these metrics in a highly strategic, professional, and encouraging tone. Output a detailed breakdown covering:
1. **Z-Score Calibration & Standing**: Explain how the current standardization curves for SFT, ET, and ICT affect the overall Z-score. Point out which subject is boosting them and which is pulling them down.
2. **District & Island Rank Estimation**: Provide realistic context for the current Estimated Island Rank (${getIslandRank}) and District Rank (${getDistrictRank} in ${district}). Compare this to typical historical university cutoffs for G.C.E. A/L Technology stream (e.g. University of Sri Jayewardenepura, University of Moratuwa, University of Kelaniya, Rajarata, Sabaragamuwa, etc.) for the preferred course: ${targetCourseLabel}.
3. **Admission Pathway Analysis**: Which specific state universities can the student currently expect to get into in their district (${district})? What are the high-tier "stretch" options they can unlock?
4. **Concrete Raw Marks Goals to Bridge the Gap**: Specify exactly how many raw marks (%) they must add to SFT, ET, and/or ICT to reach their target Z-score of +${targetZ.toFixed(2)}. Suggest a realistic, high-yield subject-wise micro-marks target strategy.
5. **Actionable Study Advice**: Offer 3 highly focused study tactics for their weakest subjects.

Please respond in a clean, readable markdown format, using subheadings, bullet points, and highlight cards. Respond in a blend of English and Sinhala (mixed/Sinhala-English) to make it highly friendly and understandable, but keep structural terms professional. Keep the tone motivational and laser-focused on actual state university entries. Do not use generic placeholders.
`;

    // Prepare message history
    const nextHistory = [...chatHistory];
    if (customPrompt) {
      nextHistory.push({ role: "user", text: customPrompt });
    } else {
      nextHistory.push({ role: "user", text: `Run comprehensive rank and cutoff analysis for ${district} district.` });
    }
    setChatHistory(nextHistory);

    try {
      const response = await apiFetch("/api/ai/respond-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          activeSubject: currentSubject,
          mode: "zscore_prediction",
          history: nextHistory.map((h) => ({
            role: h.role,
            parts: [{ text: h.text }]
          })),
          prompt: systemPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = new SSEParser();
        let currentText = "";

        let doneReading = false;
        while (!doneReading) {
          const { value, done } = await reader.read();
          doneReading = done;

          if (value) {
            const chunkString = decoder.decode(value, { stream: true });
            const sseEvents = parser.parse(chunkString);

            for (const sse of sseEvents) {
              if (sse.data === "[DONE]" || sse.event === "done") {
                doneReading = true;
                break;
              }
              try {
                const parsedChunk = JSON.parse(sse.data);
                if (sse.event === "error") {
                  setError(parsedChunk.message || "Failed to load prediction.");
                  doneReading = true;
                  break;
                } else if (parsedChunk.text) {
                  currentText += parsedChunk.text;
                  setAnalysisText(currentText);
                  
                  // Scroll to bottom smoothly during stream
                  if (bottomRef.current) {
                    bottomRef.current.scrollIntoView({ behavior: "smooth" });
                  }
                }
              } catch (e) {
                // Ignore chunk parsing error
              }
            }
          }
        }

        setChatHistory(prev => [...prev, { role: "model", text: currentText }]);
      }
    } catch (err: any) {
      console.error("[AiMetricsAdvisor] Streaming error:", err);
      setError(err.message || "Could not generate AI prediction. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpPrompt.trim() || loading) return;
    const promptToSend = followUpPrompt;
    setFollowUpPrompt("");
    runAiAnalysis(promptToSend);
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (loading) return;
    runAiAnalysis(suggestion);
  };

  return (
    <div id="ai-metrics-advisor-block" className="mt-6 bg-slate-900 border border-slate-800 rounded-[2rem] p-6 text-white shadow-xl space-y-6 overflow-hidden relative">
      {/* Background radial gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative border-b border-slate-800/80 pb-4">
        <div>
          <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            AI Score & Rank Advisor (Beta)
          </h4>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Standardize your metrics and get customized State University cutoff predictions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-extrabold text-indigo-300 bg-indigo-950/80 border border-indigo-900 px-2 py-1 rounded-xl uppercase">
            Gemini Flash 2.0 Live
          </span>
        </div>
      </div>

      {/* INPUT SETTINGS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Home District
          </label>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
          >
            {SRI_LANKA_DISTRICTS.map((dist) => (
              <option key={dist} value={dist} className="bg-slate-900 text-white font-semibold">
                {dist}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-indigo-400" /> Preferred Course
          </label>
          <select
            value={preferredCourse}
            onChange={(e) => setPreferredCourse(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
          >
            {POPULAR_COURSES.map((course) => (
              <option key={course.value} value={course.value} className="bg-slate-900 text-white font-semibold">
                {course.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SUBMIT BUTTON */}
      {!analysisText && !loading && (
        <button
          type="button"
          onClick={() => runAiAnalysis()}
          className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-extrabold py-3.5 px-6 rounded-2xl text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] shadow-lg shadow-primary-950/50"
        >
          <Sparkles className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '3s' }} />
          Analyze Admission & Predict Island Rank
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* STREAMING RESPONSE VIEW */}
      {(analysisText || loading || error) && (
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden text-left flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" /> Real-time Advisor Response
            </span>
            {loading && (
              <span className="text-[9px] font-bold text-slate-400 animate-pulse flex items-center gap-1">
                <Loader2 className="w-3 h-3 text-primary-500 animate-spin" /> Thinking & generating...
              </span>
            )}
          </div>

          {error && (
            <div className="p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Execution Error</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {analysisText && (
            <div className="prose prose-invert prose-xs max-w-none text-slate-100 font-sans leading-relaxed text-xs overflow-y-auto max-h-[350px] pr-2 scrollbar-thin">
              <ReactMarkdown>{analysisText}</ReactMarkdown>
              {loading && (
                <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 rounded-xs"></span>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Quick suggestions chips */}
          {!loading && (
            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800/50">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider w-full mb-1">
                Ask follow-up questions:
              </span>
              <button
                type="button"
                onClick={() => handleSuggestionClick(`Suggest standard marks needed in ICT, ET and SFT to improve my Island Rank by 500.`)}
                className="bg-slate-900 hover:bg-slate-850 text-indigo-300 border border-indigo-950/60 hover:border-indigo-900 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
              >
                🎯 Improve Island Rank by 500
              </button>
              <button
                type="button"
                onClick={() => handleSuggestionClick(`Which universities can I get into with a Z-score of +${(overallZ + 0.3).toFixed(3)} for ${preferredCourse === 'engineering_tech' ? 'Engineering Technology' : preferredCourse === 'biosystems_tech' ? 'Biosystems Technology' : 'ICT'} in ${district} district?`)}
                className="bg-slate-900 hover:bg-slate-850 text-emerald-300 border border-emerald-950/60 hover:border-emerald-900 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
              >
                🏫 Unlock Stretch Universities (+0.3 Z)
              </button>
              <button
                type="button"
                onClick={() => handleSuggestionClick(`Provide a 3-week tactical high-intensity study roadmap for my lowest scoring subject.`)}
                className="bg-slate-900 hover:bg-slate-850 text-amber-300 border border-amber-950/60 hover:border-amber-900 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
              >
                📚 3-Week Study Roadmap
              </button>
            </div>
          )}

          {/* INPUT FORM */}
          {!loading && (
            <form onSubmit={handleFollowUpSubmit} className="flex gap-2 relative mt-1">
              <input
                type="text"
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                placeholder="Ask follow-up (e.g. How to balance SFT self-study...)"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-slate-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl p-2 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
