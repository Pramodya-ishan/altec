import { apiFetch } from "../../lib/api";
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SYLLABUS } from '../../constants/syllabus';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { PredictorWidget } from '../widgets/PredictorWidget';

export function PaperStructureView() {
  const { currentSubject, data, toggleTopic, setModals, currentView, saveData, showNotification, triggerStars } = useApp();
  const def = SYLLABUS[currentSubject];
  const subjectData = data[currentSubject];

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    return {
      mcq: data.collapsedStates?.paperStructure_mcq ?? false,
      partA: data.collapsedStates?.paperStructure_partA ?? false,
      partBCD: data.collapsedStates?.paperStructure_partBCD ?? false,
    };
  });

  useEffect(() => {
    setCollapsedSections({
      mcq: data.collapsedStates?.paperStructure_mcq ?? false,
      partA: data.collapsedStates?.paperStructure_partA ?? false,
      partBCD: data.collapsedStates?.paperStructure_partBCD ?? false,
    });
  }, [data.collapsedStates]);

  // Quiz Modal State Variables
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuizQuestionIdx, setCurrentQuizQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [completedQuiz, setCompletedQuiz] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [isTopicSelectionMode, setIsTopicSelectionMode] = useState(false);

  // Microphone voice support states
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");

  // Automatically expand sections and scroll to target topic if selected from Global Search
  useEffect(() => {
    const highlightTopic = localStorage.getItem('search_highlight_topic');
    if (highlightTopic) {
      setCollapsedSections({
        mcq: false,
        partA: false,
        partBCD: false,
      });

      const timer = setTimeout(() => {
        const element = document.getElementById(`topic-card-${highlightTopic}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('animate-highlight-flash');
          localStorage.removeItem('search_highlight_topic');
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentSubject, currentView]);

  // Voice Input Implementation using Web Speech API
  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showNotification("Web Speech API is not supported by your browser. Please try Chrome or Safari.", "error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceTranscript("");
      showNotification("🎙️ Listening... State your answer clearly (Say option like 'A', 'B', 'C', 'D' or state the words).", "info");
    };

    recognition.onerror = (e: any) => {
      console.error("Speech recognition error:", e);
      setIsListening(false);
      showNotification("Could not recognize speech or mic access blocked. Try again or click to select.", "error");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      setVoiceTranscript(transcript);
      
      let matchedIndex: number | null = null;
      const currentQuestion = quizQuestions[currentQuizQuestionIdx];
      const options = currentQuestion?.options || [];

      // Pattern match A, B, C, D references
      if (
        transcript === "a" || 
        transcript.startsWith("option a") || 
        transcript.includes("choose a") || 
        transcript.includes("ans a") || 
        transcript.startsWith("ay") || 
        transcript.includes("first option") || 
        transcript === "one" || 
        transcript === "1"
      ) {
        matchedIndex = 0;
      } else if (
        transcript === "b" || 
        transcript.startsWith("option b") || 
        transcript.includes("choose b") || 
        transcript.includes("ans b") || 
        transcript.startsWith("bee") || 
        transcript.startsWith("be") || 
        transcript.includes("second option") || 
        transcript === "two" || 
        transcript === "2"
      ) {
        matchedIndex = 1;
      } else if (
        transcript === "c" || 
        transcript.startsWith("option c") || 
        transcript.includes("choose c") || 
        transcript.includes("ans c") || 
        transcript.startsWith("cee") || 
        transcript.startsWith("see") || 
        transcript.startsWith("sea") || 
        transcript.includes("third option") || 
        transcript === "three" || 
        transcript === "3"
      ) {
        matchedIndex = 2;
      } else if (
        transcript === "d" || 
        transcript.startsWith("option d") || 
        transcript.includes("choose d") || 
        transcript.includes("ans d") || 
        transcript.startsWith("dee") || 
        transcript.includes("fourth option") || 
        transcript === "four" || 
        transcript === "4"
      ) {
        matchedIndex = 3;
      } else {
        // Semantic/word-match overlap
        let bestOverlapCount = 0;
        let bestIndex = -1;
        const words = transcript.split(/\s+/);
        
        options.forEach((opt: string, idx: number) => {
          const optLower = opt.toLowerCase();
          let overlap = 0;
          words.forEach((word: string) => {
            if (word.length > 2 && optLower.includes(word)) {
              overlap += 1;
            }
          });
          if (overlap > bestOverlapCount) {
            bestOverlapCount = overlap;
            bestIndex = idx;
          }
        });

        if (bestIndex !== -1 && bestOverlapCount >= 1) {
          matchedIndex = bestIndex;
        }
      }

      if (matchedIndex !== null) {
        setSelectedAnswer(matchedIndex);
        showNotification(`🎙️ Heard: "${event.results[0][0].transcript}" ➔ Auto-selected Option ${["A", "B", "C", "D"][matchedIndex]}`, "success");
      } else {
        showNotification(`🎙️ Heard: "${event.results[0][0].transcript}". Could not match an option text. Please speak more clearly.`, "info");
      }
    };

    recognition.start();
  };

  const getMcqMaxForTopic = (sub: string, topicName: string) => {
    const syllabusDef = SYLLABUS[sub as 'sft' | 'et' | 'ict'];
    let mcqMax = 10;
    if (syllabusDef && syllabusDef.mcqItems) {
      syllabusDef.mcqItems.forEach(item => {
        if (item.title === topicName) mcqMax = item.count || 10;
      });
    }
    return mcqMax;
  };

  const getWeakestTopic = () => {
    let weakestTopic = "";
    let lowestAvg = 101;
    
    const topicScores: Record<string, { total: number; count: number }> = {};
    
    // Process MCQ items performance to find weaknesses
    const qMarks = subjectData.questionMarks || {};
    Object.entries(qMarks).forEach(([topic, mList]: [string, any]) => {
      if (!mList || mList.length === 0) return;
      let totalPercentSum = 0;
      let count = 0;
      const mcqMax = getMcqMaxForTopic(currentSubject, topic);
      
      mList.forEach((m: any) => {
        const mcqVal = m.mcqRaw ?? (m.mcqPer ? (m.mcqPer / 100) * mcqMax : m.mcq ?? 0);
        const mcqPercent = (mcqVal / mcqMax) * 100;
        const partAPercent = m.partARaw ?? (m.partAPer ? m.partAPer : m.pA ?? 0);
        const partBcdPercent = ((m.partBcdRaw ?? (m.partBcdPer ? m.partBcdPer : m.essay ?? 0)) / 150) * 100;

        const combinedPercent = (mcqPercent + partAPercent + partBcdPercent) / 3;
        totalPercentSum += combinedPercent;
        count++;
      });
      
      if (count > 0) {
        topicScores[topic] = { total: totalPercentSum, count };
      }
    });

    Object.entries(topicScores).forEach(([topic, scoreData]) => {
      const avg = scoreData.total / scoreData.count;
      if (avg < lowestAvg) {
        lowestAvg = avg;
        weakestTopic = topic;
      }
    });

    // Fallback if no question logs scored yet: find a checked syllabus topic, or random syllabus topic
    if (!weakestTopic) {
      const checkedTopics = Object.keys(subjectData.topics || {}).filter(t => subjectData.topics[t]?.checked);
      if (checkedTopics.length > 0) {
        weakestTopic = checkedTopics[Math.floor(Math.random() * checkedTopics.length)];
      } else {
        const mcqItems = def.mcqItems || [];
        if (mcqItems.length > 0) {
          weakestTopic = mcqItems[Math.floor(Math.random() * mcqItems.length)].title;
        } else {
          weakestTopic = "සෛල (ක්ෂුද්‍රජීව විද්‍යාව ඇතුළුව)"; // default Sri Lankan SFT syllabus item
        }
      }
    }
    return weakestTopic;
  };

  const fetchQuizQuestions = async (topic: string) => {
    setLoadingQuiz(true);
    setQuizError("");
    setQuizQuestions([]);
    setCurrentQuizQuestionIdx(0);
    setSelectedAnswer(null);
    setIsAnswerSubmitted(false);
    setQuizScore(0);
    setCompletedQuiz(false);

    if ((topic === "තාපාය" || topic === "තාපය") && currentSubject === "sft") {
      const predefinedQuiz = [
        {
          "id": 1,
          "question": "උෂ්ණත්වය 10 °C හි දී පෙට්රල්වල ඝනත්වය 0.72 kg L-1 වේ. පෙට්රල්වල පරිමා ප්රසාරණ සංගුණකය 9.6 x 10^-4 °C-1 වේ. උෂ්ණත්වය 30 °C හි පවතින පොම්පයකින් පෙට්රල් 40 L ක් මිල දී ගැනීමේ දී, එම පොම්පයෙන් ම 10 °C හි දී එම පරිමාව ම මිල දී ගැනීමට සාපේක්ෂව කොපමණ ස්කන්ධයක් අහිමි වේ ද? (පොම්පය උෂ්ණත්වය සඳහා හානිපූරණය කර නොමැත.)",
          "options": [
            "(1) 0.2 kg",
            "(2) 0.4 kg",
            "(3) 0.5 kg",
            "(4) 0.7 kg",
            "(5) 0.9 kg"
          ],
          "explanation": "2023/2024 A/L SFT - Q43",
          "correctIndex": 2
        },
        {
          "id": 2,
          "question": "තෙල් 500 ml කින් සම්පූර්ණයෙන් ම පුරවා ඇති ලෝහ බෝතලයක් 20 °C හි ඇත. උෂ්ණත්වය 70 °C දක්වා වැඩි කළ විට, තෙල් 3.5 ml ක් උතුරා යයි. තෙල්වල පරිමා ප්රසාරණ සංගුණකය 9.5 x 10^-4 °C-1 නම්, ලෝහයේ පරිමා ප්රසාරණ සංගුණකය කුමක් ද?",
          "options": [
            "(1) 1.5 x 10^-4 °C-1",
            "(2) 6.2 x 10^-4 °C-1",
            "(3) 8.1 x 10^-4 °C-1",
            "(4) 9.5 x 10^-4 °C-1",
            "(5) 10.9 x 10^-4 °C-1"
          ],
          "explanation": "2024 A/L SFT - Q47",
          "correctIndex": 2
        },
        {
          "id": 3,
          "question": "උණු වතුර බෝතලයක (Thermo flask) ඇති රික්තක කලාපය සම්බන්ධ පහත ප්රකාශ සලකන්න. A - එය සන්නයනයෙන් ඇති කරන තාප හානිය අවම කරයි. B - එය සංවහනයෙන් ඇති කරන තාප හානිය අවම කරයි. C - එය විකිරණයෙන් ඇති කරන තාප හානිය අවම කරයි. ඉහත ප්රකාශ අතුරින් නිවැරදි ප්රකාශය/ප්රකාශ වනුයේ,",
          "options": [
            "(1) A පමණි.",
            "(2) B පමණි.",
            "(3) A සහ B පමණි.",
            "(4) A සහ C පමණි.",
            "(5) A, B සහ C සියල්ලම."
          ],
          "explanation": "2020 A/L SFT - Q50",
          "correctIndex": 2
        },
        {
          "id": 4,
          "question": "තඹ කැබැල්ලක් ශීතකරණයක් තුළ සිසිල් කර, කාමර උෂ්ණත්වයේ ඇති ජලය අඩංගු තාප පරිවරණය කළ භාජනයකට දමන ලදී. තඹවල විශිෂ්ට තාප ධාරිතාව ගණනය කිරීම සඳහා අවශ්ය නොවන තොරතුර කුමක් ද?",
          "options": [
            "(1) ජලයේ ස්කන්ධය",
            "(2) තඹ කැබැල්ලේ ස්කන්ධය",
            "(3) ජලයේ විශිෂ්ට තාප ධාරිතාව",
            "(4) සිසිල් කළ තඹ කැබැල්ලේ උෂ්ණත්වය",
            "(5) පද්ධතිය කාමර උෂ්ණත්වයට ළඟාවීමට ගතවන කාලය"
          ],
          "explanation": "2021/2022 A/L SFT - Q45",
          "correctIndex": 4
        },
        {
          "id": 5,
          "question": "කාමර උෂ්ණත්වයේ දී ජලයේ විශිෂ්ට තාප ධාරිතාව 4.2 x 10^3 J kg^-1 K^-1 නම්, පහත සඳහන් ප්රකාශ අතුරින් සත්ය වනුයේ කුමක් ද?",
          "options": [
            "(1) ජලය 1 g ට 4.2 J ක තාප ශක්ති ප්රමාණයක් සැපයූ විට එහි උෂ්ණත්වය 1 °C කින් ඉහළ යයි.",
            "(2) ජලය 1 kg ට 4.2 J ක තාප ශක්ති ප්රමාණයක් සැපයූ විට එහි උෂ්ණත්වය 1 °C කින් ඉහළ යයි.",
            "(3) ජලය 1 kg ට 1.0 J ක තාප ශක්ති ප්රමාණයක් සැපයූ විට එහි උෂ්ණත්වය 1 °C කින් ඉහළ යයි.",
            "(4) ජලය 1 kg ට 4.2 x 10^3 J ක තාප ශක්ති ප්රමාණයක් සැපයූ විට එහි උෂ්ණත්වය 100 °C කින් ඉහළ යයි.",
            "(5) ජලය 1 kg ට 4.2 x 10^3 J ක තාප ශක්ති ප්රමාණයක් සැපයූ විට එහි උෂ්ණත්වය 273 °C කින් ඉහළ යයි."
          ],
          "explanation": "2017 A/L SFT - Q49",
          "correctIndex": 0
        }
      ];
      setTimeout(() => {
        setQuizQuestions(predefinedQuiz);
        setLoadingQuiz(false);
      }, 800);
      return;
    }

    try {
      const response = await apiFetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: currentSubject, topic }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.quiz && Array.isArray(result.quiz) && result.quiz.length > 0) {
          setQuizQuestions(result.quiz);
        } else {
          setQuizError("Received empty quiz questions from system.");
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setQuizError(errData.error || "Failed to contact quiz engine.");
      }
    } catch {
      setQuizError("Network failure connecting to AI workspace.");
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;
    setIsAnswerSubmitted(true);
    const isCorrect = selectedAnswer === quizQuestions[currentQuizQuestionIdx].correctIndex;
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuizQuestionIdx < quizQuestions.length - 1) {
      setCurrentQuizQuestionIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswerSubmitted(false);
    } else {
      // Quiz finished! Save the score to Lesson Marks questions data
      setCompletedQuiz(true);
      try {
        const nextData = structuredClone(data);
        let topicMarks = nextData[currentSubject].questionMarks[selectedTopic];
        if (!topicMarks) {
          topicMarks = [];
          nextData[currentSubject].questionMarks[selectedTopic] = topicMarks;
        }
        
        const mcqMax = getMcqMaxForTopic(currentSubject, selectedTopic);
        // Correct answers index to score. e.g. quizScore out of 5, normalized to mcqMax
        const finalNormalizedScore = Math.round((quizScore / 5) * mcqMax * 10) / 10;
        
        const saveTitle = `⚡ AI Quick Test (${new Date().toLocaleDateString('si-LK')})`;
        
        const newEntry = {
          title: saveTitle,
          time: Date.now(),
          mcqRaw: finalNormalizedScore
        };
        topicMarks.push(newEntry);
        topicMarks.sort((a: any, b: any) => a.time - b.time);
        
        import('../../lib/scoreUtils').then(({ calculateSubjectAveragePercent, calculateSubjectZ }) => {
           const sftMark = calculateSubjectAveragePercent('sft', nextData);
           const etMarkBase = calculateSubjectAveragePercent('et', nextData);
           const etMark = Math.min(100, (etMarkBase * 0.75) + 25);
           const ictMark = calculateSubjectAveragePercent('ict', nextData);
           const sftZ = calculateSubjectZ('sft', sftMark);
           const etZ = calculateSubjectZ('et', etMark);
           const ictZ = calculateSubjectZ('ict', ictMark);
           const overallZScore = Number(((sftZ + etZ + ictZ) / 3).toFixed(3));

           if (!nextData.zScoreHistory) nextData.zScoreHistory = [];
           nextData.zScoreHistory.push({
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
              zScore: overallZScore,
              subjectZScores: { sft: sftZ, et: etZ, ict: ictZ },
              reason: `Finished Quick Test: ${selectedTopic} - Z-score updated`
           });

           saveData(nextData);
        });
        if (showNotification) {
          showNotification(`Quick test complete! Normalised score: ${finalNormalizedScore}/${mcqMax}`, 'success');
        }
        if (quizScore >= 4 && triggerStars) {
          triggerStars();
        }
      } catch (err) {
        console.error("Failed to auto-save completed test session to App Data:", err);
      }
    }
  };

  const toggleSection = (id: string) => {
    const nextCollapsed = !collapsedSections[id];
    setCollapsedSections(prev => ({ ...prev, [id]: nextCollapsed }));

    const updatedCollapsedStates = {
      ...data.collapsedStates,
      [`paperStructure_${id}`]: nextCollapsed
    };

    saveData({
      ...data,
      collapsedStates: updatedCollapsedStates
    });
  };

  const openPlaylist = (topic: string) => {
    setModals(prev => ({ ...prev, playlist: { open: true, topic } }));
  };

  const CheckOrAddButton = ({ topic, part, max }: { topic: string; part: string; max?: number }) => {
    const isChecked = subjectData.topics[topic]?.checked;

    return (
      <button
        className={cn(
          "shrink-0 flex items-center gap-1.5 transition-all text-sm font-medium cursor-pointer active:scale-95 px-2 py-1 rounded-md",
          isChecked ? "text-emerald-600 bg-emerald-50" : "text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600"
        )}
        onClick={() => toggleTopic(topic)}
      >
        <i className={cn("fa-circle-check", isChecked ? "fa-solid" : "fa-regular")}></i>
      </button>
    );
  };

  const TopicLink = ({ topic, part }: { topic: string; part?: string }) => {
    const qMarks = subjectData.questionMarks?.[topic] || [];
    const lastMarkWithMyPart = [...qMarks].reverse().find(m => {
      if (part === 'MCQ') return m.mcqRaw !== undefined && m.mcqRaw !== null;
      if (part === 'A') return m.partARaw !== undefined && m.partARaw !== null;
      if (part === 'BCD') return m.partBcdRaw !== undefined && m.partBcdRaw !== null;
      return false;
    });

    return (
      <span
        onClick={() => openPlaylist(topic)}
        className="text-sm font-semibold text-slate-700 cursor-pointer hover:text-primary-600 hover:underline transition-all block text-left line-clamp-2 leading-tight"
        title={topic}
      >
        {topic}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* HEADER switcher removed */}
      <div className="flex justify-end gap-3 items-center w-full relative z-10">
      </div>

      {/* Dynamic Pop-up AI Quiz Modal */}
      <AnimatePresence>
        {quizModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100 font-sans text-slate-800"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-5 md:p-6 flex justify-between items-center relative shrink-0">
                <div className="space-y-1">
                  <span className="bg-white/20 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {isTopicSelectionMode ? "Unit Test Selection" : "Unit Test Drill"}
                  </span>
                  <h3 className="text-lg md:text-xl font-display font-bold truncate max-w-lg" title={selectedTopic || "Select a Topic"}>
                    {isTopicSelectionMode ? "Select Unit" : selectedTopic}
                  </h3>
                </div>
                <button
                  onClick={() => setQuizModalOpen(false)}
                  className="text-white/80 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              {/* Topic Selection Mode */}
              {isTopicSelectionMode && (
                <div className="flex-1 p-6 md:p-8 space-y-6 flex flex-col">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-800">Select a Lesson for the Unit Test</h4>
                    <p className="text-xs text-slate-500">
                      Choose a specific lesson to test your knowledge.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="relative">
                      <select
                        value={selectedTopic}
                        onChange={(e) => setSelectedTopic(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all pr-12 cursor-pointer"
                      >
                        <option value="" disabled>Select a lesson ...</option>
                        {def.mcqItems?.map((item: any, idx: number) => (
                          <option key={idx} value={item.title}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <i className="fa-solid fa-chevron-down text-sm"></i>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => {
                        if (selectedTopic) {
                          setIsTopicSelectionMode(false);
                          fetchQuizQuestions(selectedTopic);
                        } else {
                           showNotification("Please select a valid lesson first.", "error");
                        }
                      }}
                      disabled={!selectedTopic}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Start Unit Test
                    </button>
                  </div>
                </div>
              )}

              {/* Loader */}
              {loadingQuiz && !isTopicSelectionMode && (
                <div className="flex-1 py-20 flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Assessing Knowledge Gaps...</h4>
                    <p className="text-xs text-slate-500 max-w-xs px-4">
                      1st Edition is tailoring 5 A/L style questions targeted specifically on your weak syllabus milestone.
                    </p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {quizError && !loadingQuiz && !isTopicSelectionMode && (
                <div className="flex-1 p-8 text-center space-y-4 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-xl shadow-xs border border-rose-100">
                    <i className="fa-solid fa-circle-exclamation"></i>
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Failed to load quiz</h4>
                    <p className="text-xs text-slate-500 max-w-xs">{quizError}</p>
                  </div>
                  <button
                    onClick={() => fetchQuizQuestions(selectedTopic)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Interactive Quiz Body */}
              {!loadingQuiz && !quizError && quizQuestions.length > 0 && !completedQuiz && !isTopicSelectionMode && (
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                  {/* Progress Info */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">
                      Question {currentQuizQuestionIdx + 1} of 5
                    </span>
                    <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden border border-black/5">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-300"
                        style={{ width: `${((currentQuizQuestionIdx + 1) / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Microphone answer panel */}
                  {!isAnswerSubmitted && (
                    <div className="flex items-center gap-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3 justify-between animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-center gap-2">
                        {isListening ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                            <span className="text-xs font-bold text-red-600 font-sans">Listening... state your answer</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 font-bold font-sans flex items-center gap-1">
                            <i className="fa-solid fa-microphone text-indigo-500 text-xs"></i> 
                            Voice input active
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleVoiceInput}
                        className={cn(
                          "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs transition-all active:scale-[0.98] cursor-pointer",
                          isListening 
                            ? "bg-red-500 text-white animate-pulse" 
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        )}
                      >
                        <i className={`fa-solid ${isListening ? "fa-microphone-lines" : "fa-microphone"}`}></i>
                        {isListening ? "Listening..." : "Answer by Mic"}
                      </button>
                    </div>
                  )}

                  {/* Question Title */}
                  <h4 className="text-base md:text-lg font-bold text-slate-800 leading-snug">
                    {quizQuestions[currentQuizQuestionIdx]?.question}
                  </h4>

                  {/* Options List */}
                  <div className="grid grid-cols-1 gap-3">
                    {quizQuestions[currentQuizQuestionIdx]?.options?.map((option: string, idx: number) => {
                      const isSelected = selectedAnswer === idx;
                      const isCorrect = idx === quizQuestions[currentQuizQuestionIdx]?.correctIndex;

                      let optionStyle = "border-slate-200 hover:border-indigo-200 text-slate-700 hover:bg-indigo-50/20";
                      if (isSelected) {
                        optionStyle = "border-indigo-600 bg-indigo-50/50 text-indigo-900 font-semibold shadow-xs";
                      }
                      if (isAnswerSubmitted) {
                        if (isCorrect) {
                          optionStyle = "border-emerald-500 bg-emerald-50/60 text-emerald-900 font-semibold shadow-xs";
                        } else if (isSelected) {
                          optionStyle = "border-rose-500 bg-rose-50/60 text-rose-900 font-semibold shadow-xs";
                        } else {
                          optionStyle = "border-slate-100 text-slate-400 opacity-60";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          disabled={isAnswerSubmitted}
                          onClick={() => setSelectedAnswer(idx)}
                          className={`w-full text-left p-4 rounded-2xl border text-xs sm:text-sm transition-all focus:outline-none flex items-center gap-3 cursor-pointer ${optionStyle}`}
                        >
                          <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border uppercase font-mono ${
                            isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "bg-slate-50 border-slate-200 text-slate-500"
                          }`}>
                            {["A", "B", "C", "D"][idx]}
                          </span>
                          <span className="flex-1 leading-snug">{option}</span>
                          {isAnswerSubmitted && isCorrect && (
                            <i className="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
                          )}
                          {isAnswerSubmitted && isSelected && !isCorrect && (
                            <i className="fa-solid fa-circle-xmark text-rose-600 text-lg"></i>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation Section */}
                  {isAnswerSubmitted && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-1.5"
                    >
                      <h5 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                        <i className="fa-solid fa-lightbulb text-amber-500"></i> Explanation / පැහැදිලි කිරීම
                      </h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {quizQuestions[currentQuizQuestionIdx]?.explanation}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Interactive Quiz Footer */}
              {!loadingQuiz && !quizError && quizQuestions.length > 0 && !completedQuiz && (
                <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center shrink-0">
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Score: {quizScore}
                  </span>
                  
                  {!isAnswerSubmitted ? (
                    <button
                      disabled={selectedAnswer === null}
                      onClick={handleSubmitAnswer}
                      className="bg-indigo-600 disabled:opacity-40 hover:bg-indigo-700 disabled:hover:bg-indigo-600 text-white font-black text-xs md:text-sm px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs md:text-sm px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {currentQuizQuestionIdx < 4 ? "Next Question" : "Finish Quiz"}
                    </button>
                  )}
                </div>
              )}

              {/* Quiz Results Summary */}
              {completedQuiz && !isTopicSelectionMode && (
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 flex flex-col justify-between shrink-0">
                  <div className="space-y-6 text-center">
                    <div className="w-18 h-18 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-sm">
                      🏆
                    </div>
                    
                    <div className="space-y-1.5">
                      <h4 className="text-xl md:text-2xl font-black text-slate-800 font-display">Test Drill Completed!</h4>
                      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                        Your performance on <b>{selectedTopic}</b> has been recorded to update your study analytics log.
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-2xl p-5 border border-indigo-100 max-w-xs mx-auto grid grid-cols-2 divide-x divide-indigo-100">
                      <div className="text-center space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Your Score</span>
                        <h5 className="text-2xl font-black text-indigo-700">{quizScore} / 5</h5>
                      </div>
                      <div className="text-center space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Accuracy</span>
                        <h5 className="text-2xl font-black text-indigo-700">{(quizScore / 5) * 100}%</h5>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setQuizModalOpen(false);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs md:text-sm py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] mt-6 cursor-pointer"
                  >
                    Return to Syllabus
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MCQ SECTION */}
      <div>
        <button
          type="button"
          onClick={() => toggleSection('mcq')}
          className="w-full flex justify-between items-center py-3 mb-4 border-b border-slate-200 text-slate-500 text-sm font-extrabold uppercase tracking-wider focus:outline-none focus:ring-0 cursor-pointer text-left select-none bg-transparent"
        >
          <span>MCQ</span>
          <i className={cn("fa-solid fa-chevron-up transition-transform duration-300", collapsedSections['mcq'] && "rotate-180")}></i>
        </button>

        <AnimatePresence initial={false}>
          {!collapsedSections['mcq'] && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="bg-white border border-slate-200 rounded-[1.5rem] p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
                  <h2 className="text-2xl text-slate-900 font-display font-extrabold tracking-tight">MCQ ({currentSubject.toUpperCase()})</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {def.mcqItems.map(item => (
                    <div key={item.title} id={`topic-card-${item.title}`} className="flex items-center gap-2.5 bg-white p-3 border border-slate-200 rounded-xl hover:border-primary-500 hover:shadow-md transition-all duration-300 group min-w-0 overflow-hidden">
                      <div className="flex flex-col items-center justify-center shrink-0">
                        <div className="bg-slate-50/80 text-slate-600 text-[10px] font-black px-1.5 py-0.5 rounded-md min-w-[3rem] text-center group-hover:bg-primary-50 group-hover:text-primary-700 transition-colors leading-tight">
                          {item.q}
                        </div>
                        <span className="text-[10px] text-primary-600 font-extrabold mt-1 tracking-tight leading-none">
                          {item.count} MCQ{item.count && item.count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="shrink-0">
                        <CheckOrAddButton topic={item.title} part="MCQ" max={item.count} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <TopicLink topic={item.title} part="MCQ" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start mt-8">
        <div className="xl:col-span-8 flex flex-col space-y-10">
          {/* ESSAY PART A SECTION */}
          {(def.partAItems.length > 0) && (
            <div>
              <button
                type="button"
                className="w-full flex justify-between items-center py-3 mb-4 border-b border-slate-200 text-slate-500 text-sm font-extrabold uppercase tracking-wider focus:outline-none focus:ring-0 cursor-pointer text-left select-none bg-transparent"
                onClick={() => toggleSection('partA')}
              >
                <span>Part A</span>
                <i className={cn("fa-solid fa-chevron-up transition-transform duration-300", collapsedSections['partA'] && "rotate-180")}></i>
              </button>

              <AnimatePresence initial={false}>
                {!collapsedSections['partA'] && (
                  <motion.article 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white border border-slate-200 rounded-[1.5rem] p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="mb-6">
                        <h2 className="text-2xl text-slate-900 font-display font-extrabold tracking-tight">Structured Essay (Part A)</h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {def.partAItems.map((item, idx) => (
                          <div key={item.q} className={cn("flex gap-4 py-3")}>
                            <div className="bg-slate-50 border border-slate-100 text-slate-600 text-sm font-bold px-3 h-9 rounded-lg flex items-center justify-center shrink-0">
                              {item.q}
                            </div>
                            <div className="flex-1">
                              {item.subTitle && <h3 className="text-[15px] font-semibold text-slate-700 mb-3">{item.subTitle}</h3>}
                              <ul className="flex flex-col gap-3">
                                {item.topics?.map(topic => (
                                  <li key={topic} className="flex items-center gap-2.5">
                                    <CheckOrAddButton topic={topic} part="A" max={item.max} />
                                    <TopicLink topic={topic} part="A" />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.article>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ESSAY PART BCD SECTION */}
          {def.bcdGroups && def.bcdGroups.length > 0 && (
            <div>
              <button
                type="button"
                className="w-full flex justify-between items-center py-3 mb-4 border-b border-slate-200 text-slate-500 text-sm font-extrabold uppercase tracking-wider focus:outline-none focus:ring-0 cursor-pointer text-left select-none bg-transparent"
                onClick={() => toggleSection('partBCD')}
              >
                <span>Essay (Part B, C, D)</span>
                <i className={cn("fa-solid fa-chevron-up transition-transform duration-300", collapsedSections['partBCD'] && "rotate-180")}></i>
              </button>

              <AnimatePresence initial={false}>
                {!collapsedSections['partBCD'] && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {def.bcdGroups.map(group => (
                        <article key={group.label} className="bg-white border border-slate-200 rounded-[1.5rem] p-6 shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="mb-5">
                            <div className="inline-block px-3 py-1 bg-primary-50 text-primary-600 text-xs font-bold uppercase rounded-full mb-3 tracking-widest border border-primary-100">
                              {group.label}
                            </div>
                            <h2 className="text-xl text-slate-900 font-display font-extrabold tracking-tight">{group.title}</h2>
                          </div>
                          <div className={cn(group.label.includes('6න්') ? "grid grid-cols-1 gap-3" : "flex flex-col")}>
                            {group.items.map((item, idx) => (
                              <div key={item.q} className={cn("flex gap-3 py-4", idx > 0 && !group.label.includes('6න්') && "border-t border-slate-100")}>
                                <div className="bg-slate-50 border border-slate-100 text-slate-600 text-sm font-bold px-3 h-9 rounded-lg flex items-center justify-center shrink-0">
                                  {item.q}
                                </div>
                                <div className="flex-1">
                                  {item.subTitle && <h3 className="text-[15px] font-semibold text-slate-700 mb-2">{item.subTitle}</h3>}
                                  <ul className="flex flex-col gap-2">
                                    {item.topics?.map(topic => (
                                      <li key={topic} className="flex items-center gap-2.5">
                                        <CheckOrAddButton topic={topic} part="BCD" max={item.max} />
                                        <TopicLink topic={topic} part="BCD" />
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        
        <div className="xl:col-span-4 sticky top-24">
          <PredictorWidget />
        </div>
      </div>
    </div>
  );
}
