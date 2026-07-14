import { apiFetch } from "../../lib/api";

import { SSEParser } from "../../lib/sseParser";

import {
  GraduationCap,
  LineChart,
  TrendingUp,
  ArrowRight,
  Bed,
  Target,
  Rocket,
  Quote,
  CheckSquare,
  Zap,
  Clock,
  BookOpen,
  Loader2,
  AlertTriangle,
  Database,
  MapPin,
  Globe,
  Brain,
  Copy,
  ExternalLink,
  Trash2,
  AlertCircle,
  Sparkles,
  User,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  Calculator,
  Flame,
} from "lucide-react";

import React, { useState, useEffect, useMemo } from "react";

import { motion, AnimatePresence } from "motion/react";

import { ResponsiveChartShell } from "../ui/ResponsiveChartShell";
import { AiMetricsAdvisor } from "../widgets/AiMetricsAdvisor";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { useApp } from "../../context/AppContext";

import { cn } from "../../lib/utils";

import { SYLLABUS } from "../../constants/syllabus";

import {
  calculateSubjectZ,
  calculateSubjectAveragePercent,
  getEstIslandRank,
  getEstDistrictRank,
} from "../../lib/scoreUtils";

import { RequirementQuestion } from "../../types";

import Markdown from "react-markdown";

import remarkGfm from "remark-gfm";

import remarkMath from "remark-math";

import rehypeKatex from "rehype-katex";

import "katex/dist/katex.min.css";

import Lottie from "lottie-react";

import { gsap } from "gsap";

import aiLogoAnimation from "../../assets/ai-logo.json";

import thinkingAnimation from "../../assets/thinking-animation.json";

import {
  AdvisorReport,
  AdvisorMessage,
  ProcessedAdvisorResponse,
  processAdvisorResponse,
  normalizeFormula,
  looksLikeAdvisorJson,
} from "../../lib/advisorParser";

export const SubjectTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataEntry = payload[0].payload;

    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-4 min-w-[200px]">
        <p className="text-slate-500 font-bold text-xs uppercase mb-2">
          {label}
        </p>
        <div className="space-y-1">
          {payload.map(
            (entry: any, index: number) =>
              entry.value !== null &&
              entry.value !== undefined && (
                <div
                  key={`item-${index}`}
                  className="flex justify-between items-center gap-4"
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <span
                      className="text-slate-600 text-xs font-semibold"
                      style={{ color: entry.color }}
                    >
                      {entry.name}
                    </span>
                  </div>
                  <span
                    className="text-slate-900 font-bold text-sm tracking-tight"
                    style={{ color: entry.color }}
                  >
                    {entry.value > 0 ? "+" : ""}
                    {entry.value}
                  </span>
                </div>
              ),
          )}
        </div>
        {dataEntry.reason && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
              Reason
            </p>
            <p className="text-xs text-slate-700 font-medium leading-snug">
              {dataEntry.reason}
            </p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const DiagnosticJsonDashboard = ({
  data,
  onActionClick,
}: {
  data: AdvisorReport;
  onActionClick?: (action: string) => void;
}) => {
  const [expandedPoint, setExpandedPoint] = React.useState<number | null>(null);

  if (looksLikeAdvisorJson(data as any)) {
    // It might be unparsed JSON string if there was an issue, but we rely on the parser to pass the object
  }

  // Fallback for older formats
  if ((data as any).actionPlan && !data.studentSummary) {
    return (
      <div className="text-red-500 font-bold p-4 bg-red-100 rounded-lg">
        Legacy report format detected. Please generate a new analysis.
      </div>
    );
  }

  if (!data.studentSummary) return null;

  return (
    <div className="space-y-6 w-full text-left not-prose font-sans ">
      {/* HEADER SUMMARY CARD */}
      <div className="p-6 bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-950 rounded-[1.8rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none -rotate-12">
          <GraduationCap className="w-24 h-24 text-white" />
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-indigo-800/40 pb-5 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full">
                Advisory Session
              </span>
              <span className="text-xs font-mono text-indigo-300">
                Report v{data.version}
              </span>
            </div>
            <h4 className="text-lg font-black text-white tracking-tight">
              {data.studentSummary.studentName}
            </h4>
          </div>

          <div className="flex flex-wrap gap-2 text-left">
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl px-4 py-2">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block leading-none mb-1">
                Target Z-Score
              </span>
              <span className="text-xl font-black text-white font-mono leading-none">
                {data.studentSummary.targetZScore?.toFixed(4) || "N/A"}
              </span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-2">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block leading-none mb-1">
                Days to A/L Exam
              </span>
              <span className="text-xl font-black text-white font-mono leading-none">
                {data.countdown.toExamStart}
              </span>
            </div>
          </div>
        </div>

        {data.targetFeasibility && (
          <div
            className={cn(
              "p-4 border rounded-2xl flex items-start gap-3",
              data.targetFeasibility.feasibility.includes("realistic")
                ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-200"
                : data.targetFeasibility.feasibility.includes("possible")
                  ? "bg-amber-950/40 border-amber-500/20 text-amber-200"
                  : "bg-rose-950/40 border-rose-500/20 text-rose-200",
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-xl border flex items-center justify-center shrink-0",
                data.targetFeasibility.feasibility.includes("realistic")
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : data.targetFeasibility.feasibility.includes("possible")
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400",
              )}
            >
              <LineChart className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm leading-relaxed font-medium">
              <div className="font-bold mb-1 opacity-90 uppercase tracking-wide text-[10px]">
                Feasibility:{" "}
                {data.targetFeasibility.feasibility.replace(/_/g, " ")}
              </div>
              <Markdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {normalizeFormula(data.targetFeasibility.explanation)}
              </Markdown>
            </div>
          </div>
        )}
      </div>

      {/* CORE ANALYSIS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Z-SCORE DELTA CARD */}
        {data.zScoreChange && (
          <div className="bg-white border border-slate-200 rounded-[1.5rem] p-5 shadow-sm">
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <TrendingUp className="w-5 h-5 text-indigo-500" /> Z-Score Delta
              Analysis
            </h5>

            <div className="flex items-center gap-4 mb-4">
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Previous
                </div>
                <div className="text-lg font-black font-mono text-slate-700">
                  {data.zScoreChange.previousOverallZ?.toFixed(4) || "N/A"}
                </div>
              </div>
              <div className="text-slate-300">
                <ArrowRight className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Current
                </div>
                <div className="text-lg font-black font-mono text-indigo-600">
                  {data.zScoreChange.currentOverallZ?.toFixed(4) || "N/A"}
                </div>
              </div>

              {data.zScoreChange.delta !== null && (
                <div
                  className={cn(
                    "ml-auto px-3 py-1.5 rounded-xl font-black text-sm",
                    data.zScoreChange.delta > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : data.zScoreChange.delta < 0
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-50 text-slate-700",
                  )}
                >
                  {data.zScoreChange.delta > 0 ? "+" : ""}
                  {data.zScoreChange.delta.toFixed(4)}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
              {data.zScoreChange.interpretation}
            </div>
          </div>
        )}

        {/* SLEEP PLAN CARD */}
        {data.sleepPlan && (
          <div className="bg-white border border-slate-200 rounded-[1.5rem] p-5 shadow-sm">
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
              <Bed className="w-5 h-5 text-indigo-500" /> Scientific Sleep
              Protocol
            </h5>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 font-bold uppercase">
                  Current Pattern
                </div>
                <div className="text-sm font-black text-slate-700 mt-1">
                  {data.sleepPlan.currentPattern}
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <div className="text-[10px] text-indigo-400 font-bold uppercase">
                  Recommended
                </div>
                <div className="text-sm font-black text-indigo-700 mt-1">
                  {data.sleepPlan.recommendedPattern}
                </div>
              </div>
            </div>

            {data.sleepPlan.risks?.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] text-rose-500 font-bold uppercase mb-1">
                  Potential Risks
                </div>
                <ul className="list-disc pl-4 text-xs text-rose-700/80 space-y-0.5">
                  {data.sleepPlan.risks.map((risk, i) => (
                    <li key={i}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOP LESSONS LIST */}
      {data.combinedTopLessons?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-5 h-5 text-rose-500" /> High-Impact Lessons
              to Master
            </h5>
            <p className="text-[11px] text-slate-500 mt-1">
              Calculated based on max expected Z-Score gain.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {data.combinedTopLessons.map((lesson, idx) => (
              <div
                key={idx}
                className="p-4 flex flex-col sm:flex-row items-start gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-black text-xs flex items-center justify-center shrink-0">
                  {lesson.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border",
                        lesson.subject === "SFT"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : lesson.subject === "ET"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200",
                      )}
                    >
                      {lesson.subject}
                    </span>
                    <span className="font-bold text-sm text-slate-800">
                      {lesson.lesson}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mt-1">
                    {lesson.reason}
                  </p>
                </div>
                <div className="text-right shrink-0 flex sm:flex-col gap-3 sm:gap-1 items-end mt-2 sm:mt-0">
                  <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold font-mono">
                    +{lesson.expectedZImpact?.toFixed(3) || "N/A"} Z
                  </div>
                  {lesson.estimatedHours && (
                    <div className="text-[10px] text-slate-400 font-bold">
                      {lesson.estimatedHours}h est.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECOVERY SCENARIOS */}
      {data.recoveryScenarios && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {["conservative", "realistic", "stretch"].map((type) => {
            const scenario =
              data.recoveryScenarios[
                type as keyof typeof data.recoveryScenarios
              ];

            if (!scenario) return null;

            const isStretch = type === "stretch";

            return (
              <div
                key={type}
                className={cn(
                  "border rounded-xl p-4 flex flex-col",
                  isStretch
                    ? "bg-indigo-900 border-indigo-800 text-white shadow-md relative overflow-hidden"
                    : "bg-white border-slate-200",
                )}
              >
                {isStretch && (
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <Rocket className="w-10 h-10" />
                  </div>
                )}
                <div
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-widest mb-2",
                    isStretch ? "text-indigo-300" : "text-slate-400",
                  )}
                >
                  {type} Scenario
                </div>
                <div
                  className={cn(
                    "text-2xl font-black font-mono mb-2",
                    isStretch ? "text-white" : "text-slate-800",
                  )}
                >
                  {scenario.targetOverallZ.toFixed(4)}
                </div>
                <p
                  className={cn(
                    "text-xs flex-1",
                    isStretch ? "text-indigo-100/80" : "text-slate-500",
                  )}
                >
                  {scenario.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* FINAL ADVICE & ACTIONS */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-3xl p-6">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Quote className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-2">
              Professor's Final Directive
            </h5>
            <div className="text-sm text-indigo-950/80 font-medium leading-relaxed italic">
              <Markdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {normalizeFormula(data.finalAdvice)}
              </Markdown>
            </div>
          </div>
        </div>

        {data.immediateActions?.length > 0 && (
          <div className="mt-6 pt-5 border-t border-indigo-200/50">
            <h6 className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-3">
              Immediate 24-Hour Actions
            </h6>
            <div className="space-y-2">
              {data.immediateActions.map((action, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="mt-0.5">
                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-xs md:text-sm text-indigo-900 font-medium">
                    {action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QUICK ACTIONS ROW */}
      {onActionClick && (
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch gap-2 pt-2 pb-2">
          <button
            onClick={() =>
              onActionClick(
                "Generate a structured dynamic action plan with daily targets and success metrics based on my CURRENT progress.",
              )
            }
            className="flex-1 min-w-[140px] border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-800 font-bold text-[11px] sm:text-xs px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 text-center"
          >
            <Zap className="w-5 h-5 text-amber-500" /> Plan Generator
          </button>

          <button
            onClick={() =>
              onActionClick(
                "Generate a perfect day plan explaining how to execute this strategy hour by hour.",
              )
            }
            className="flex-1 min-w-[140px] border border-indigo-200/60 bg-white hover:bg-indigo-50 text-indigo-700 font-bold text-[11px] sm:text-xs px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 text-center"
          >
            <Clock className="w-5 h-5 text-indigo-500" /> Perfect Day Plan
          </button>

          <button
            onClick={() =>
              onActionClick(
                "Give me a long detailed explanation of these strategies.",
              )
            }
            className="flex-1 min-w-[140px] border border-rose-200/60 bg-white hover:bg-rose-50 text-rose-700 font-bold text-[11px] sm:text-xs px-4 py-3 rounded-2xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 text-center"
          >
            <BookOpen className="w-5 h-5 text-rose-500" /> Detailed Review
          </button>
        </div>
      )}
    </div>
  );
};

const renderMessageContent = (
  message: AdvisorMessage,
  onActionClick?: (action: string) => void,
) => {
  if (message.sender !== "assistant") {
    return (
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {message.text}
      </Markdown>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {message.text && message.text.length > 5 && (
        <Markdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {message.text}
        </Markdown>
      )}

      {message.isStreaming && (!message.text || message.text.length <= 5) && (
        <div className="flex items-center gap-2 p-4 text-indigo-500 animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span
            className="text-sm font-bold tracking-tight"
            id="ai-status-loader-text"
          >
            Analyzing & Planning...
          </span>
        </div>
      )}

      {message.parseError && !message.report && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl shadow-sm my-4">
          <h4 className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Parsing Error
          </h4>
          <p className="text-sm">
            The advisor successfully generated a report, but the JSON format was
            unreadable. This occurs occasionally with AI output.
          </p>
          <div className="mt-3 flex">
            <button
              onClick={() =>
                onActionClick &&
                onActionClick("Please try again and generate the report")
              }
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
            >
              Retry parsing request
            </button>
          </div>
        </div>
      )}

      {message.report && (
        <DiagnosticJsonDashboard
          data={message.report}
          onActionClick={onActionClick}
        />
      )}
    </div>
  );
};

export default function AdmissionPredictorView() {
  const { data, saveData, isAuthLoading } = useApp();

  const [zTab, setZTab] = useState<"detector" | "analytics" | "advisor">(
    "detector",
  );

  // Target settings
  const [targetZ, setTargetZ] = useState<number>(() => {
    if (data.targetZ !== undefined) return data.targetZ;

    const saved = localStorage.getItem("admission_target_z_score");

    return saved ? Number(saved) : 2.5;
  });

  const [calcMarks, setCalcMarks] = useState({ sft: 50, et: 50, ict: 50 });

  useEffect(() => {
    if (data.targetZ !== undefined && data.targetZ !== targetZ) {
      setTargetZ(data.targetZ);
    }
  }, [data.targetZ]);

  const handleTargetZChange = (val: number) => {
    localStorage.setItem("admission_target_z_score", val.toString());

    setTargetZ(val);

    saveData({ ...data, targetZ: val });
  };

  // Live raw marks calculated dynamically from the Exam Score Predictor system
  const sftMark = calculateSubjectAveragePercent("sft", data);

  const etMarkBase = calculateSubjectAveragePercent("et", data);

  const etMark = Math.min(100, etMarkBase * 0.75 + 25);

  const ictMark = calculateSubjectAveragePercent("ict", data);

  const sftZ = calculateSubjectZ("sft", sftMark);

  const etZ = calculateSubjectZ("et", etMark);

  const ictZ = calculateSubjectZ("ict", ictMark);

  const overallZScore = Number(((sftZ + etZ + ictZ) / 3).toFixed(4));

  // State to store real pre-populated/saved history of changes for the area chart
  const [historyPoints, setHistoryPoints] = useState<any[]>(
    data.zScoreHistory || [],
  );

  useEffect(() => {
    if (isAuthLoading) return;
    // Prevent overwriting data before user data is loaded

    let points = data.zScoreHistory ? [...data.zScoreHistory] : [];

    const today = new Date();

    const todayDateStr =
      today.toLocaleDateString("en-US", { month: "short", day: "2-digit" }) +
      " (Today)";

    const todaySimple = today.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });

    let updated = false;

    if (!points || points.length === 0) {
      points = [];

      for (let i = 6; i >= 1; i--) {
        const pastDate = new Date();

        pastDate.setDate(today.getDate() - i);

        const pDate = pastDate.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
        });

        points.push({
          date: pDate,
          zScore: Number(Math.max(-2.5, overallZScore - i * 0.05).toFixed(4)),
          subjectZScores: { sft: sftZ, et: etZ, ict: ictZ },
          reason: "",
        });
      }
      points.push({
        date: todayDateStr,
        zScore: overallZScore,
        subjectZScores: { sft: sftZ, et: etZ, ict: ictZ },
        reason: "",
      });

      updated = true;
    } else {
      let todayFoundIndex = -1;

      points = points.map((p: any, idx: number) => {
        if (p.date === todayDateStr) {
          todayFoundIndex = idx;

          if (p.zScore !== overallZScore) {
            updated = true;

            const prevS = p.subjectZScores || { sft: sftZ, et: etZ, ict: ictZ };

            const sDiff = sftZ - prevS.sft;

            const eDiff = etZ - prevS.et;

            const iDiff = ictZ - prevS.ict;

            let reasons = [];

            if (sDiff > 0.001)
              reasons.push(`SFT improved (+${sDiff.toFixed(3)})`);
            else if (sDiff < -0.001)
              reasons.push(`SFT dropped (${sDiff.toFixed(3)})`);

            if (eDiff > 0.001)
              reasons.push(`ET improved (+${eDiff.toFixed(3)})`);
            else if (eDiff < -0.001)
              reasons.push(`ET dropped (${eDiff.toFixed(3)})`);

            if (iDiff > 0.001)
              reasons.push(`ICT improved (+${iDiff.toFixed(3)})`);
            else if (iDiff < -0.001)
              reasons.push(`ICT dropped (${iDiff.toFixed(3)})`);

            const reasonStr =
              reasons.length > 0
                ? reasons.join(", ")
                : p.reason || "Scores aligned.";

            return {
              ...p,
              zScore: overallZScore,
              subjectZScores: { sft: sftZ, et: etZ, ict: ictZ },
              reason: reasonStr,
            };
          }
          return p;
        } else if (p.date.includes("(Today)")) {
          const cleanDate = p.date.replace(/\s*\(Today\)/, "");

          if (cleanDate === todaySimple) {
            todayFoundIndex = idx;

            if (p.zScore !== overallZScore) {
              updated = true;

              const prevS = p.subjectZScores || {
                sft: sftZ,
                et: etZ,
                ict: ictZ,
              };

              const sDiff = sftZ - prevS.sft;

              const eDiff = etZ - prevS.et;

              const iDiff = ictZ - prevS.ict;

              let reasons = [];

              if (sDiff > 0.001)
                reasons.push(`SFT improved (+${sDiff.toFixed(3)})`);
              else if (sDiff < -0.001)
                reasons.push(`SFT dropped (${sDiff.toFixed(3)})`);

              if (eDiff > 0.001)
                reasons.push(`ET improved (+${eDiff.toFixed(3)})`);
              else if (eDiff < -0.001)
                reasons.push(`ET dropped (${eDiff.toFixed(3)})`);

              if (iDiff > 0.001)
                reasons.push(`ICT improved (+${iDiff.toFixed(3)})`);
              else if (iDiff < -0.001)
                reasons.push(`ICT dropped (${iDiff.toFixed(3)})`);

              const reasonStr =
                reasons.length > 0
                  ? reasons.join(", ")
                  : p.reason || "Scores aligned.";

              return {
                ...p,
                date: todayDateStr,
                zScore: overallZScore,
                subjectZScores: { sft: sftZ, et: etZ, ict: ictZ },
                reason: reasonStr,
              };
            }
            return { ...p, date: todayDateStr };
          }
          updated = true;

          return { ...p, date: cleanDate };
        }
        return p;
      });

      if (todayFoundIndex === -1) {
        points.push({
          date: todayDateStr,
          zScore: overallZScore,
          subjectZScores: { sft: sftZ, et: etZ, ict: ictZ },
          reason: "New target logged",
        });

        updated = true;
      }
    }

    setHistoryPoints(points);

    if (updated) {
      const newData = structuredClone(data);

      newData.zScoreHistory = points;

      const timer = setTimeout(() => {
        if (saveData) saveData(newData);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [
    overallZScore,
    data.zScoreHistory,
    data,
    saveData,
    sftZ,
    etZ,
    ictZ,
    isAuthLoading,
  ]);

  const chartData = useMemo(() => {
    if (!historyPoints || historyPoints.length === 0) return [];

    const parseDateStr = (dateStr?: string) => {
      if (!dateStr) return new Date(2026, 5, 18, 12, 0, 0);

      let cleanStr = dateStr.replace(/\s*\(Today\)/gi, "").trim();

      if (cleanStr.includes("-")) {
        const parts = cleanStr.split("-").map(Number);

        if (parts.length === 3) {
          const [y, m, d] = parts;

          return new Date(y === 2001 ? 2026 : y, m - 1, d, 12, 0, 0);
          // Handle 2001 year
        }
      }
      const parsed = new Date(cleanStr);

      if (!isNaN(parsed.getTime())) {
        parsed.setFullYear(2026);

        parsed.setHours(12, 0, 0, 0);

        return parsed;
      }
      return new Date(2026, 5, 18, 12, 0, 0);
    };

    const sortedPoints = [...historyPoints].sort(
      (a, b) => parseDateStr(a.date).getTime() - parseDateStr(b.date).getTime(),
    );

    const filledData = [];

    const startDate = parseDateStr(sortedPoints[0].date);

    const endDate = parseDateStr(sortedPoints[sortedPoints.length - 1].date);

    let daysCount = 0;

    let lastKnownZ = sortedPoints[0].zScore;

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      if (daysCount++ > 730) break;
      // 2 years limit

      const dateStr =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");

      const exactPoints = sortedPoints.filter((p) => {
        const pD = parseDateStr(p.date);

        const pFormatted =
          pD.getFullYear() +
          "-" +
          String(pD.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(pD.getDate()).padStart(2, "0");

        return pFormatted === dateStr;
      });

      const exactPoint =
        exactPoints.length > 0
          ? exactPoints[exactPoints.length - 1]
          : undefined;

      if (exactPoint) {
        lastKnownZ = exactPoint.zScore;
      }

      filledData.push({
        name: dateStr,
        "Calculated Z Score": lastKnownZ,
        "My Target": targetZ,
        reason: exactPoint ? exactPoint.reason : undefined,
      });
    }

    if (filledData.length === 1) {
      const yesterday = new Date(startDate);

      yesterday.setDate(yesterday.getDate() - 1);

      const dateStr =
        yesterday.getFullYear() +
        "-" +
        String(yesterday.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(yesterday.getDate()).padStart(2, "0");

      filledData.unshift({
        name: dateStr,
        "Calculated Z Score": lastKnownZ,
        "My Target": targetZ,
        reason: "Started tracking",
      });
    }

    return filledData;
  }, [historyPoints, targetZ]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-4 min-w-[200px]">
          <p className="text-slate-500 font-bold text-xs uppercase mb-2">
            {label}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div
                key={index}
                className="flex justify-between items-center gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-slate-600 text-xs font-semibold">
                    {entry.name}
                  </span>
                </div>
                <span
                  className="text-slate-900 font-bold text-sm tracking-tight"
                  style={{ color: entry.color }}
                >
                  {entry.value > 0 ? "+" : ""}
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
          {payload[0] && payload[0].payload.reason && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                Reason for change
              </p>
              <p className="text-xs text-slate-700 font-medium leading-snug">
                {payload[0].payload.reason}
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const zDifference = Number((overallZScore - targetZ).toFixed(4));

  const isTargetMet = zDifference >= 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 ">
      {/* HEADER WITH TOGGLE SWITCH */}
      <AnimatePresence mode="wait">
        {zTab === "detector" && (
          <motion.div
            key="detector-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* PRIMARY WORKSPACE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: LIVE COHORT METRICS SUMMARY cards (5 columns) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-transparent border-none shadow-none p-0 space-y-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200/80 pb-3">
                    <Database className="w-5 h-5 text-primary-500" /> Subject
                    Predictor Metrics
                  </h3>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl text-center shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-[0.03] pointer-events-none -rotate-12">
                        <LineChart className="w-10 h-10 text-indigo-900" />
                      </div>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1 leading-tight relative">
                        Overall Z
                      </p>
                      <p className="text-lg font-black text-indigo-700 tracking-tight relative">
                        {overallZScore > 0 ? "+" : ""}
                        {overallZScore.toFixed(4)}
                      </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl text-center shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-[0.03] pointer-events-none -rotate-12">
                        <MapPin className="w-10 h-10 text-emerald-900" />
                      </div>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1 leading-tight relative">
                        Dist Rank
                      </p>
                      <p className="text-lg font-black text-emerald-700 relative">
                        {getEstDistrictRank(overallZScore)}
                      </p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-2xl text-center shadow-sm relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 p-2 opacity-[0.03] pointer-events-none rotate-12">
                        <Globe className="w-10 h-10 text-amber-900" />
                      </div>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1 leading-tight relative">
                        Island Rank
                      </p>
                      <p className="text-lg font-black text-amber-700 relative">
                        {getEstIslandRank(overallZScore)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    {/* SFT */}
                    <div className="p-5 bg-white border border-slate-200 rounded-3xl flex flex-col gap-3 shadow-2xs text-left ">
                      <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-2.5">
                        <span className="text-[10px] sm:text-[11px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded shrink-0">
                          SFT
                        </span>
                        <span className="text-xs font-bold text-slate-800 leading-none truncate flex-1 pl-1">
                          Science for Technology
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0 whitespace-nowrap">
                          Cohort Curve
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                            Raw Score
                          </span>
                          <div className="text-xl font-extrabold text-slate-900 leading-none">
                            {Number(sftMark.toFixed(2))}%
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                            Subject Z
                          </span>
                          <div className="text-xl font-mono font-black text-slate-700 leading-none">
                            {sftZ >= 0 ? "+" : ""}
                            {sftZ.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ET */}
                    <div className="p-5 bg-white border border-slate-200 rounded-3xl flex flex-col gap-3 shadow-2xs text-left ">
                      <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-2.5">
                        <span className="text-[10px] sm:text-[11px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded shrink-0">
                          ET
                        </span>
                        <span className="text-xs font-bold text-slate-800 leading-none truncate flex-1 pl-1">
                          Engineering Tech
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0 whitespace-nowrap">
                          Cohort Curve
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                            Raw Score
                          </span>
                          <div className="text-xl font-extrabold text-slate-900 leading-none">
                            {Number(etMark.toFixed(2))}%
                          </div>
                          <div className="text-[9px] font-semibold text-rose-600 mt-1">
                            (75% Paper + 25% Practical)
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                            Subject Z
                          </span>
                          <div className="text-xl font-mono font-black text-slate-700 leading-none">
                            {etZ >= 0 ? "+" : ""}
                            {etZ.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ICT */}
                    <div className="p-5 bg-white border border-slate-200 rounded-3xl flex flex-col gap-3 shadow-2xs text-left ">
                      <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-2.5">
                        <span className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded shrink-0">
                          ICT
                        </span>
                        <span className="text-xs font-bold text-slate-800 leading-none truncate flex-1 pl-1">
                          Information Tech
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0 whitespace-nowrap">
                          Cohort Curve
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                            Raw Score
                          </span>
                          <div className="text-xl font-extrabold text-slate-900 leading-none">
                            {Number(ictMark.toFixed(2))}%
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                            Subject Z
                          </span>
                          <div className="text-xl font-mono font-black text-slate-700 leading-none">
                            {ictZ >= 0 ? "+" : ""}
                            {ictZ.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                </div>
              </div>

              {/* RIGHT COLUMN: CHRONOLOGICAL PROGRESSION AREA CHART (7 columns) */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-[1.8rem] border border-slate-200 p-6 shadow-sm space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <LineChart className="w-5 h-5 text-primary-500" /> Z-Score
                      vs. Admission Target Progress Tracker
                    </h3>
                    <div className="flex gap-3 items-center">
                      {chartData.length > 0 && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Start Day: {chartData[0].name}
                        </span>
                      )}
                      <span className="text-[10px] font-extrabold text-primary-600 bg-primary-50 px-2 py-1 rounded border border-primary-100 uppercase">
                        Vitals Live
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-80 min-h-0 min-w-0">
                    <ResponsiveChartShell minHeight={320}>
                      <ResponsiveContainer
                        width="100%"
                        height={320}
                        minWidth={0}
                      >
                        <AreaChart
                          data={chartData}
                          margin={{ top: 15, right: 15, left: -25, bottom: 20 }}
                        >
                          <defs>
                            <linearGradient
                              id="progressZ"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="var(--primary-500)"
                                stopOpacity={0.2}
                              />
                              <stop
                                offset="95%"
                                stopColor="var(--primary-500)"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f1f5f9"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            stroke="#94a3b8"
                            fontSize={10}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                            dy={15}
                            angle={0}
                            textAnchor="middle"
                            interval="preserveStartEnd"
                            minTickGap={34}
                            tickFormatter={(value) => String(value).slice(5)}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={10}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                            domain={[-2.5, 3.0]}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend
                            verticalAlign="top"
                            height={36}
                            iconType="circle"
                            wrapperStyle={{ fontSize: "11px", fontWeight: 700 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Calculated Z Score"
                            stroke="var(--primary-500)"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#progressZ)"
                            activeDot={{ r: 6 }}
                          />
                          <ReferenceLine
                            y={targetZ}
                            stroke="#ec4899"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            label={{
                              value: `Target: +${targetZ.toFixed(2)}`,
                              fill: "#ec4899",
                              fontSize: 10,
                              fontWeight: 800,
                              position: "top",
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ResponsiveChartShell>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NotebookLMAdvisor({ appData }: { appData: any }) {
  const { showNotification, currentSubject } = useApp();

  const handleCopyData = () => {
    const dataToCopy = JSON.stringify(appData, null, 2);

    navigator.clipboard.writeText(dataToCopy);

    showNotification(
      "Data copied to clipboard! Paste it into NotebookLM.",
      "success",
    );
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-[1.5rem] p-6 shadow-sm transition-all duration-300 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 mb-4 border-b border-slate-100 pb-4 font-sans text-left shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-500 shrink-0 shadow-sm">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 font-display flex items-center gap-1.5 lg:text-xl tracking-tight leading-tight text-left">
              NotebookLM Advisor
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Analyze your progress with Google NotebookLM
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyData}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Copy className="w-4 h-4" /> Copy Data
          </button>
          <a
            href="https://notebooklm.google.com/notebook/411f2e5c-ad33-41d9-a956-c6fc4bb8e236"
            target="_blank"
            rel="noreferrer"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <ExternalLink className="w-4 h-4" /> Open App
          </a>
        </div>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 relative flex flex-col items-center justify-center text-center p-8 min-h-[300px]">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-400">
              <Copy className="w-6 h-6" />
            </div>
            <div className="w-8 h-px bg-slate-300"></div>
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl shadow-md border border-indigo-500 flex items-center justify-center text-white">
              <ExternalLink className="w-6 h-6" />
            </div>
          </div>

          <div>
            <h4 className="text-xl font-black text-slate-800 tracking-tight mb-2">
              Two-Step Analysis
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              Google Accounts cannot be authenticated securely within embedded
              frames. To analyze your progress without redirect errors:
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-left space-y-3 shadow-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                1
              </div>
              <p className="text-sm text-slate-700">
                Click <strong>Copy Data</strong> above to copy your current
                progress payload.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                2
              </div>
              <p className="text-sm text-slate-700">
                Click <strong>Open App</strong> to open NotebookLM securely in a
                new tab, then paste your data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface AdvisorProps {
  targetZ: number;

  overallZ: number;

  sftZ: number;

  etZ: number;

  ictZ: number;

  sftMark: number;

  etMark: number;

  ictMark: number;

  zScoreHistory?: any[];

  appData?: any;

  saveData?: any;
}

const DEFAULT_PLANNING_QUESTIONS: RequirementQuestion[] = [
  {
    id: "plan_scope",
    questionSi:
      "ඔයාට full-day plan එකක්ද, A/L exam එක පටන් ගන්න දවස දක්වා day-by-day plan එකක්ද, නැත්නම් දෙකමද ඕනේ?",
    questionEn:
      "Do you need a full-day plan, a day-by-day plan until A/L, or both?",
    type: "single_choice",
    required: true,
    options: [
      { value: "full_day", labelSi: "Full-day plan" },
      { value: "until_al", labelSi: "A/L වෙනකම් plan" },
      { value: "both", labelSi: "දෙකම" },
    ],
    recommendedValue: "both",
    whyNeeded: "The plan structure depends on the selected time range.",
  },
  {
    id: "weekday_hours",
    questionSi:
      "School සහ tuition හැර weekday එකක study කරන්න පුළුවන් පැය ගණන කීයද?",
    type: "number",
    required: true,
    recommendedValue: 5,
    whyNeeded: "This prevents an unrealistic daily workload.",
  },
  {
    id: "weekend_hours",
    questionSi: "Weekend දවසක study කරන්න පුළුවන් පැය ගණන කීයද?",
    type: "number",
    required: true,
    recommendedValue: 8,
    whyNeeded: "Weekend capacity changes the paper and revision schedule.",
  },
  {
    id: "fixed_commitments",
    questionSi:
      "School, tuition, travel, sports, cadet, prefect duties සහ වෙනත් fixed times මොනවාද?",
    type: "text",
    required: false,
    recommendedValue: "",
    whyNeeded: "Study blocks must not overlap fixed commitments.",
  },
  {
    id: "sleep_schedule",
    questionSi: "සාමාන්යයෙන් නිදාගන්න සහ නැගිටින වේලාව මොකක්ද?",
    type: "text",
    required: true,
    recommendedValue: "Sleep 10:30 PM, wake 5:30 AM",
    whyNeeded: "The plan must protect sleep and recovery.",
  },
  {
    id: "scientific_methods",
    questionSi:
      "Active Recall, Spaced Repetition, Interleaving, Blurting සහ Error Log plan එකට add කරන්නද?",
    type: "single_choice",
    required: true,
    options: [
      { value: "all", labelSi: "Recommended methods සියල්ල add කරන්න" },
      { value: "custom", labelSi: "Methods select කරන්න" },
      { value: "simple", labelSi: "Simple plan එකක්" },
    ],
    recommendedValue: "all",
    whyNeeded: "The selected methods change the revision workflow.",
  },
  {
    id: "past_papers",
    questionSi: "2016–2025 past papers subject තුනටම complete කරන්න ඕනේද?",
    type: "single_choice",
    required: true,
    options: [
      {
        value: "all_sections",
        labelSi: "Subject තුනටම MCQ, Structured සහ Essay",
      },
      { value: "mcq_first", labelSi: "MCQ first" },
      { value: "custom", labelSi: "Custom selection" },
    ],
    recommendedValue: "all_sections",
    whyNeeded: "Past-paper volume must fit the remaining days.",
  },
  {
    id: "language",
    questionSi: "Final response එක ඕනේ මොන language එකෙන්ද?",
    type: "single_choice",
    required: true,
    options: [
      { value: "si", labelSi: "සිංහල" },
      { value: "en", labelSi: "English" },
      { value: "mixed", labelSi: "සිංහල + English" },
    ],
    recommendedValue: "mixed",
    whyNeeded: "This controls the final response language.",
  },
];

export function AiProgressDiagnosticsSummary({
  targetZ,
  overallZ,
  sftZ,
  etZ,
  ictZ,
  sftMark,
  etMark,
  ictMark,
  zScoreHistory,
  appData,
  saveData,
}: AdvisorProps) {
  const { showNotification, currentSubject } = useApp();

  const [summary, setSummary] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);

  const [error, setError] = useState<string>("");

  const [quizState, setQuizState] = useState<{
    questions: RequirementQuestion[];

    answers: Record<string, any>;

    isComplete: boolean;
  }>(() => {
    try {
      const savedAnswers = localStorage.getItem("clora_advisor_quiz_answers");

      const isCompleteStr = localStorage.getItem("clora_advisor_quiz_complete");

      return {
        questions: DEFAULT_PLANNING_QUESTIONS,
        answers: savedAnswers ? JSON.parse(savedAnswers) : {},
        isComplete: isCompleteStr === "true",
      };
    } catch (e) {
      return {
        questions: DEFAULT_PLANNING_QUESTIONS,
        answers: {},
        isComplete: false,
      };
    }
  });

  const handleQuizSubmit = (submittedAnswers: any) => {
    const updatedState = {
      ...quizState,
      answers: submittedAnswers,
      isComplete: true,
    };

    setQuizState(updatedState);

    localStorage.setItem(
      "clora_advisor_quiz_answers",
      JSON.stringify(submittedAnswers),
    );

    localStorage.setItem("clora_advisor_quiz_complete", "true");
  };

  const currentFootprint = `${sftMark}-${etMark}-${ictMark}-${targetZ}`;

  const [lastAnalysisFootprint, setLastAnalysisFootprint] = useState<
    string | null
  >(() => {
    return localStorage.getItem("clora_advisor_last_footprint");
  });

  const [messages, setMessages] = useState<AdvisorMessage[]>(() => {
    try {
      const cachedV3 = localStorage.getItem("clora_advisor_messages_v3");

      if (cachedV3) return JSON.parse(cachedV3);

      const cachedV1 = localStorage.getItem("clora_advisor_messages_v1");

      const cachedV2 = localStorage.getItem("clora_advisor_messages_v2");

      let oldMessages = [];

      if (cachedV2) {
        oldMessages = JSON.parse(cachedV2);
      } else if (cachedV1) {
        oldMessages = JSON.parse(cachedV1);
      }

      if (oldMessages.length > 0) {
        const migrated = oldMessages
          .map((msg: any) => {
            if (
              msg.sender === "assistant" &&
              typeof msg.text === "string" &&
              !msg.report
            ) {
              const processed = processAdvisorResponse(msg.text);

              return {
                ...msg,
                text: processed.cleanText,
                report: processed.report || null,
                parseError: processed.parseError,
              };
            }
            return msg;
          })
          .filter(
            (msg: any) =>
              !(msg.sender === "assistant" && msg.parseError && !msg.report),
          );

        localStorage.setItem(
          "clora_advisor_messages_v3",
          JSON.stringify(migrated),
        );

        return migrated;
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  const isZChanged =
    messages &&
    messages.length > 0 &&
    lastAnalysisFootprint !== currentFootprint;

  const [userInput, setUserInput] = useState<string>("");

  const [suggestions, setSuggestions] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem("clora_advisor_suggestions_v1");

      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });

  const [isThinkingProgress, setIsThinkingProgress] = useState<boolean>(false);

  const [thinkingStageText, setThinkingStageText] = useState<string>(
    "",
  );

  const [confirmClearChat, setConfirmClearChat] = useState<boolean>(false);

  const [initialPromptSent, setInitialPromptSent] = useState<boolean>(false);

  useEffect(() => {
    if (
      messages.length === 0 &&
      !loading &&
      !isThinkingProgress &&
      !initialPromptSent
    ) {
      setInitialPromptSent(true);

      // Let handleReply run out of the render cycle
      setTimeout(() => {
        handleReply(
          "Analyze my progress and provide a 12-point exhaustive strategic breakdown covering all undone lessons, past papers methodology for all 3 subjects, note exam dates (ET: Aug 11, SFT: Aug 18, ICT: Aug 25), enforce a 12-hour minimum study plan, give Z-score reality check (how to increase/decrease and current status). Mention top 8 main lessons for all 3 subjects, degree possible with current Z-score, advice, motivation, logical critical thinking. Never say 'ayya' or 'akka' in Sinhala. Show logical suggestions.",
          true,
        );
      }, 50);
    }
  }, [messages.length, loading, isThinkingProgress, initialPromptSent]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(
        "clora_advisor_messages_v3",
        JSON.stringify(messages),
      );
    } else {
      localStorage.removeItem("clora_advisor_messages_v3");
    }
  }, [messages]);

  useEffect(() => {
    if (suggestions.length > 0) {
      localStorage.setItem(
        "clora_advisor_suggestions_v1",
        JSON.stringify(suggestions),
      );
    } else {
      localStorage.removeItem("clora_advisor_suggestions_v1");
    }
  }, [suggestions]);

  const handleReply = async (textToSend: string, isHidden: boolean = false) => {
    if (!textToSend.trim() || loading) return;

    let nextMessages = [...messages];

    if (!isHidden) {
      const userMsg: AdvisorMessage = { sender: "user", text: textToSend };

      nextMessages.push(userMsg);
    }

    setMessages(nextMessages);

    if (!isHidden) setUserInput("");

    setSuggestions([]);

    setLoading(true);

    // Remove setIsThinkingProgress(true) to keep chat visible like Gemini/ChatGPT
    setThinkingStageText(
      "",
    );

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
          history: nextMessages.map((m) => ({
            role: m.sender === "user" ? "user" : "model",
            parts: [{ text: m.text }],
          })),
          prompt: textToSend,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();

        const decoder = new TextDecoder();

        const parser = new SSEParser();

        let currentText = "";

        setMessages((prev) => [
          ...prev,
          { sender: "assistant", text: "", isStreaming: true },
        ]);

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

                if (sse.event === "status") {
                  if (parsedChunk.message) {
                    setThinkingStageText(parsedChunk.message);

                    gsap.fromTo(
                      "#ai-status-loader-text",
                      { opacity: 0.5, y: 5 },
                      { opacity: 1, y: 0, duration: 0.4 },
                    );
                  }
                } else if (sse.event === "error") {
                  setError(parsedChunk.message || "Failed to load response.");

                  doneReading = true;

                  break;
                } else if (parsedChunk.text) {
                  currentText += parsedChunk.text;

                  const statusMatches =
                    currentText.match(/\[STATUS:\s*(.*?)\]/g);

                  if (statusMatches && statusMatches.length > 0) {
                    const latestStatus =
                      statusMatches[statusMatches.length - 1];

                    setThinkingStageText(latestStatus);

                    gsap.fromTo(
                      "#ai-status-loader-text",
                      { opacity: 0.5, y: 5 },
                      { opacity: 1, y: 0, duration: 0.4 },
                    );
                  }

                  // Do not push incomplete malformed JSON during streaming
                  // Just keep accumulated internally
                }
              } catch (e) {}
            }
          }
        }

        const parsed = processAdvisorResponse(currentText);

        setMessages((prev) => {
          const updated = [...prev];

          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            text: parsed.cleanText,
            report: parsed.report,
            parseError: parsed.parseError,
            isStreaming: false,
          };

          return updated;
        });

        setSuggestions(
          parsed.suggestions.length > 0
            ? parsed.suggestions
            : [
                "What should I focus on next?",
                "How can I boost my Z-score to 2.800?",
                "Daily preparation methodology for SFT",
              ],
        );
      } else {
        setError("Could not connect to chat advisor. Please search again.");
      }
    } catch (err) {
      console.error("fetch error: ", err);

      setError("Could not fetch follow-up advisor update. Please try again.");
    } finally {
      setIsThinkingProgress(false);

      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-[1.5rem] p-6 shadow-sm transition-all duration-300 flex flex-col h-[calc(100dvh-5rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 mb-6 border-b border-slate-100 pb-5 font-sans text-left shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 font-display flex items-center gap-1.5 lg:text-xl tracking-tight leading-tight text-left">
              The AI
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!confirmClearChat) {
                setConfirmClearChat(true);

                setTimeout(() => setConfirmClearChat(false), 4000);

                return;
              }
              setConfirmClearChat(false);

              setInitialPromptSent(false);

              setMessages([]);

              setSuggestions([]);

              localStorage.removeItem("al_predictor_z_daily_history");

              localStorage.removeItem("clora_advisor_quiz_answers");

              localStorage.removeItem("clora_advisor_quiz_complete");

              localStorage.removeItem("clora_advisor_messages_v1");

              localStorage.removeItem("clora_advisor_messages_v2");

              localStorage.removeItem("clora_advisor_messages_v3");

              localStorage.removeItem("clora_advisor_suggestions_v1");

              localStorage.removeItem("clora_advisor_last_footprint");
            }}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              confirmClearChat
                ? "bg-rose-500 text-white"
                : "bg-slate-50 border border-slate-200/80 text-slate-500 hover:bg-rose-50 hover:text-rose-600",
            )}
            title={
              confirmClearChat
                ? "Click again to confirm reset"
                : "Reset Advisor & History"
            }
          >
            {confirmClearChat ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isThinkingProgress && (
        <div className="py-12 flex flex-col items-center justify-center space-y-6 bg-white border-0">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-left">
          <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-xs leading-relaxed text-rose-800 font-bold">
              {error}
            </p>
            <button
              onClick={() => handleReply("Retry")}
              className="text-xs font-black text-indigo-600 hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Interactive Chat messages timeline */}
      {!isThinkingProgress && (
        <div className="flex flex-col gap-6 items-start ease-out flex-1 overflow-hidden w-full relative">
          {/* BOTTOM COLUMN: Message Feed & Input */}
          <div className="w-full flex flex-col flex-1 overflow-hidden bg-white">
            <div className="flex-1 overflow-y-auto pr-4 space-y-8 flex flex-col pb-6 scroll-smooth w-full">
              {messages.map((m, idx) => {
                const isAssistant = m.sender !== "user";

                const isLastMessage = idx === messages.length - 1;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex flex-col gap-2 w-full",
                      isAssistant ? "items-start" : "items-end",
                    )}
                  >
                    <div
                      className={cn(
                        "flex gap-4 text-left relative group w-full",
                        "flex-row", // Hardcode flex-row for both so user isn't reversed
                      )}
                    >
                      {isAssistant ? null : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 z-10 self-start mt-1">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                      )}

                      <div
                        className={cn(
                          "prose prose-sm sm:prose-base max-w-none prose-headings:font-black prose-headings:tracking-tight prose-ul:list-disc prose-ol:list-decimal flex-1 overflow-x-auto relative z-10",
                          m.sender === "user"
                            ? "text-slate-500 font-medium py-1 px-0 w-full"
                            : "text-slate-600 prose-headings:text-slate-800 prose-strong:text-slate-700 prose-slate py-1 px-0 w-full",
                        )}
                      >
                        {renderMessageContent(m, (actionText) => {
                          setUserInput(actionText);

                          // Auto send action
                          handleReply(actionText);
                        })}
                      </div>
                    </div>

                    {/* Inline Message Actions */}
                    {isAssistant && (
                      <div className="flex items-center gap-4 pl-14 text-slate-400 text-xs py-1.5 select-none flex-wrap">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(m.text);

                            showNotification("Copied instructions!", "success");
                          }}
                          className="hover:text-indigo-600 transition-colors cursor-pointer p-1"
                          title="Copy text"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() =>
                            showNotification(
                              "Thanks for your feedback!",
                              "success",
                            )
                          }
                          className="hover:text-emerald-500 transition-colors cursor-pointer p-1"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() =>
                            showNotification("Feedback noted.", "info")
                          }
                          className="hover:text-red-500 transition-colors cursor-pointer p-1"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Inline Suggestions styled like Gemini Chips */}
                    {isAssistant && isLastMessage && suggestions.length > 0 && !loading && (
                      <div className="pl-0 sm:pl-14 mt-2 w-full text-left">
                        <div className="flex flex-wrap gap-2 pt-2">
                          {suggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => handleReply(sug)}
                              disabled={loading}
                              className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 px-4 py-2.5 rounded-full text-xs font-semibold transition-all shadow-sm cursor-pointer text-left flex items-center gap-2 hover:-translate-y-[1px] active:translate-y-0"
                            >
                              <Sparkles className="w-3 h-3 text-slate-400" />
                              <span>{sug}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Interactive Chat input block in AI Style */}
            <div className="relative flex items-center border-t border-slate-100 pt-5 mt-auto">
              <div className="relative w-full flex items-center bg-slate-50 border border-slate-200 rounded-full focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all px-4 py-1">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReply(userInput);
                  }}
                  placeholder="Ask AI to optimize study plans or analyze weak units..."
                  className="w-full bg-transparent p-3 pr-12 text-xs sm:text-sm font-semibold outline-none text-left text-slate-800 placeholder-slate-400"
                  disabled={loading}
                />
                <button
                  onClick={() => handleReply(userInput)}
                  disabled={loading || !userInput.trim()}
                  className="absolute right-2 w-10 h-10 bg-slate-800 hover:bg-slate-900 disabled:opacity-30 text-white rounded-full shadow-sm flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95"
                >
                  <ArrowUp className="w-3 h-3 font-black" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ZScoreCalculatorBlock({
  sftMark,
  etMark,
  ictMark,
}: {
  sftMark: number;

  etMark: number;

  ictMark: number;
}) {
  const [marks, setMarks] = useState({
    sft: Math.min(95, Math.round(sftMark) || 50),
    et: Math.min(95, Math.round(etMark) || 50),
    ict: Math.min(95, Math.round(ictMark) || 50),
  });

  const [results, setResults] = useState<{
    overallZ: number;

    sftZ: number;

    etZ: number;

    ictZ: number;
  } | null>(null);

  useEffect(() => {
    setMarks({
      sft: Math.min(95, Math.round(sftMark) || 50),
      et: Math.min(95, Math.round(etMark) || 50),
      ict: Math.min(95, Math.round(ictMark) || 50),
    });
  }, []);
  // Run once on load to initialize

  const loadPredictorSettings = () => {
    setMarks({
      sft: Math.min(95, Math.round(sftMark)),
      et: Math.min(95, Math.round(etMark)),
      ict: Math.min(95, Math.round(ictMark)),
    });
  };

  const handleCalculate = () => {
    const sZ = calculateSubjectZ("sft", marks.sft);

    const eZ = calculateSubjectZ("et", marks.et);

    const iZ = calculateSubjectZ("ict", marks.ict);

    setResults({
      sftZ: sZ,
      etZ: eZ,
      ictZ: iZ,
      overallZ: Number(((sZ + eZ + iZ) / 3).toFixed(4)),
    });
  };

  useEffect(() => {
    handleCalculate();
  }, [marks]);

  return (
    <div className="bg-white rounded-[1.5rem] border border-slate-200/80 shadow-sm p-6 max-w-3xl mx-auto space-y-8 ">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-display font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary-600" />
            Manual Z-Score Calculator
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Calculate Island & District ranks using Custom Raw Marks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMarks({ sft: 95, et: 95, ict: 95 })}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          <Flame className="w-5 h-5 text-indigo-600 animate-pulse" /> Max Out
          All (95%)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["sft", "et", "ict"] as const).map((sub) => (
          <div key={sub} className="flex flex-col gap-2 relative">
            <div className="flex justify-between items-center pl-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                {sub.toUpperCase()} Mark (%)
              </label>
              {marks[sub] < 95 ? (
                <button
                  type="button"
                  onClick={() => setMarks((prev) => ({ ...prev, [sub]: 95 }))}
                  className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider bg-transparent border-none cursor-pointer"
                >
                  Set Max
                </button>
              ) : (
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                  <Flame className="w-5 h-5 text-amber-500 animate-pulse" />{" "}
                  High Mark!
                </span>
              )}
            </div>
            <input
              type="number"
              min="0"
              max="95"
              value={marks[sub]}
              onChange={(e) => {
                const val = Math.min(95, Math.max(0, Number(e.target.value)));

                setMarks((prev) => ({ ...prev, [sub]: val }));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-inner"
            />
            {results && (
              <div className="absolute top-[38px] right-3 text-xs font-bold text-slate-400">
                Z: {results[`${sub}Z` as keyof typeof results] > 0 ? "+" : ""}
                {results[`${sub}Z` as keyof typeof results].toFixed(4)}
              </div>
            )}
          </div>
        ))}
      </div>

      {results && (
        <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white text-center mt-6 shadow-lg border border-slate-800">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
            Calculated Overall Z-Score
          </p>
          <h3 className="text-5xl font-black tracking-tight text-white mb-6">
            {results.overallZ >= 0 ? "+" : ""}
            {results.overallZ.toFixed(4)}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-900/30 border border-emerald-800/50 rounded-xl p-4">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">
                Avg Predicted District Rank
              </p>
              <p className="text-2xl font-black text-emerald-50">
                {getEstDistrictRank(results.overallZ)}
              </p>
            </div>
            <div className="bg-amber-900/30 border border-amber-800/50 rounded-xl p-4">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">
                Avg Predicted Island Rank
              </p>
              <p className="text-2xl font-black text-amber-50">
                {getEstIslandRank(results.overallZ)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
