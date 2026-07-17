import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateGrade } from '../../lib/utils';
import { PaperMark } from '../../types';
import { appendPracticeZHistory } from '../../shared/zscore';

export function AddPaperMarksModal() {
  const { modals, setModals, data, currentSubject, saveData, showNotification, triggerStars } = useApp();
  const { open, editIndex } = modals.addPaperMark;

  const [title, setTitle] = useState('');
  const [mcq, setMcq] = useState('');
  const [essay, setEssay] = useState('');
  const [practical, setPractical] = useState('');

  useEffect(() => {
    if (open && editIndex >= 0) {
      const mark = data[currentSubject].paperMarks[editIndex];
      setTitle(mark.title);
      setMcq(mark.mcq.toString());
      setEssay(mark.essay.toString());
      setPractical(mark.practical !== undefined ? mark.practical.toString() : '');
    } else {
      setTitle('');
      setMcq('');
      setEssay('');
      setPractical('');
    }
  }, [open, editIndex, currentSubject, data]);

  if (!open) return null;

  const close = () => {
    setModals(prev => ({ ...prev, addPaperMark: { open: false, editIndex: -1 } }));
  };

  const handleSave = () => {
    const parsedMcq = parseFloat(mcq) || 0;
    const parsedEssay = parseFloat(essay) || 0;
    const parsedPractical = parseFloat(practical) || 0;

    let total = 0;
    if (currentSubject === 'et') {
      if (parsedMcq > 37.5) {
        showNotification('ET MCQ marks cannot exceed 37.5.', 'error');
        return;
      }
      if (parsedEssay > 37.5) {
        showNotification('ET essay marks cannot exceed 37.5.', 'error');
        return;
      }
      if (parsedPractical > 25) {
        showNotification('ET practical marks cannot exceed 25.', 'error');
        return;
      }
      const paperTotal = parsedMcq + parsedEssay;
      if (paperTotal > 75) {
        showNotification('The ET written-paper total cannot exceed 75.', 'error');
        return;
      }
      total = paperTotal + parsedPractical;
    } else {
      total = parsedMcq + parsedEssay;
      const maxTotal = 100;
      if (total > maxTotal) {
        showNotification(`${currentSubject.toUpperCase()} total marks cannot exceed ${maxTotal}.`, 'error');
        return;
      }
    }

    const grade = calculateGrade(total, currentSubject);
    const entry: PaperMark = {
      title: title.trim() || 'Untitled paper',
      mcq: parsedMcq,
      essay: parsedEssay,
      practical: currentSubject === 'et' ? parsedPractical : undefined,
      total,
      grade,
      time: editIndex >= 0 ? data[currentSubject].paperMarks[editIndex].time : Date.now()
    };

    const nextData = structuredClone(data);
    const gradeLevels = { 'A+': 6, 'A': 5, 'B': 4, 'C': 3, 'S': 2, 'W': 1, 'F': 1 };
    
    if (editIndex >= 0) {
      nextData[currentSubject].paperMarks[editIndex] = entry;
    } else {
      const prevMarks = data[currentSubject].paperMarks;
      if (prevMarks.length > 0) {
        const lastPaper = prevMarks[prevMarks.length - 1];
        const prevLevel = gradeLevels[lastPaper.grade as keyof typeof gradeLevels] || 0;
        const newLevel = gradeLevels[grade as keyof typeof gradeLevels] || 0;
        if (newLevel > prevLevel) {
          triggerStars();
          showNotification(`Your grade improved to ${grade}.`, 'success');
        }
      } else if (grade === 'A+' || grade === 'A' || grade === 'B') {
        triggerStars();
      }
      nextData[currentSubject].paperMarks.push(entry);
    }
    
    nextData[currentSubject].paperMarks.sort((a, b) => a.time - b.time);
    
    {
      const dataWithVerifiedHistory = appendPracticeZHistory(
        nextData,
        `Paper marks saved: ${title}`,
      );
      saveData(dataWithVerifiedHistory);
      showNotification('Paper marks saved.', 'success');
      close();
    }
  };

  const isET = currentSubject === 'et';

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[10000] backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-primary-600"></i>
            <span>Add paper marks</span>
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-red-500 transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-700">Paper name</label>
            <input
              type="text"
              placeholder="For example, 2026 Model Paper 1"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-50 transition-all font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">
                MCQ marks {isET ? '(maximum 37.5)' : '(maximum 50)'}
              </label>
              <input
                type="number"
                min="0"
                step={isET ? "0.1" : "1"}
                placeholder="0"
                value={mcq}
                onChange={e => setMcq(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-50 transition-all font-medium font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Essay marks {isET ? '(maximum 37.5)' : '(maximum 50)'}
              </label>
              <input
                type="number"
                min="0"
                step={isET ? "0.1" : "1"}
                placeholder="0"
                value={essay}
                onChange={e => setEssay(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-50 transition-all font-medium font-mono"
              />
            </div>
          </div>

          {isET && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Practical marks (maximum 25)</label>
              <input
                type="number"
                min="0"
                max="25"
                placeholder="0"
                value={practical}
                onChange={e => setPractical(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-50 transition-all font-medium font-mono"
              />
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl mt-2 hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm"
          >
            Save marks
          </button>
        </div>
      </div>
    </div>
  );
}
