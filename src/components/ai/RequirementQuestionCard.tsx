import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RequirementQuestion } from '../../types';

export function RequirementQuestionCard({ 
  question, 
  value, 
  onChange 
}: { 
  question: RequirementQuestion, 
  value: any, 
  onChange: (val: any) => void 
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className="space-y-4"
      >
        <div>
          <h3 className="text-[15px] font-bold text-slate-800">{question.questionSi}</h3>
          {question.questionEn && <p className="text-xs text-slate-500 mt-1">{question.questionEn}</p>}
        </div>

        {question.whyNeeded && (
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-2">
            <i className="fa-solid fa-lightbulb text-amber-500 mt-0.5"></i>
            <p className="text-xs text-slate-600">{question.whyNeeded}</p>
          </div>
        )}

        {question.type === 'single_choice' && question.options?.map((opt, i) => (
          <button
            key={i}
            onClick={() => onChange(opt.value)}
            className={`w-full text-left p-3 rounded-xl border transition-colors ${value === opt.value ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
          >
            <div className="font-semibold text-slate-700 text-sm">{opt.labelSi}</div>
            {opt.labelEn && <div className="text-xs text-slate-500 mt-0.5">{opt.labelEn}</div>}
          </button>
        ))}
        
        {question.type === 'text' && (
          <textarea 
            className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            rows={3}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ඇතුලත් කරන්න..."
          />
        )}

        {question.type === 'number' && (
          <input 
            type="number"
            className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            min="0"
            max="24"
            placeholder="Select hours"
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
