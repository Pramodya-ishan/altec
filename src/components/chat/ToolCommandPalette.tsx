import React, { useState, useEffect, useRef } from 'react';
import { Mic, Globe, Search, Image as ImageIcon, Paperclip, FileText, Speaker } from 'lucide-react';

export interface CommandOption {
  id: string;
  command: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const COMMAND_OPTIONS: CommandOption[] = [
  { id: 'tts', command: '@tts', label: 'Text to Speech', description: 'Paste text and generate downloadable audio', icon: <Speaker className="w-4 h-4" /> },
  { id: 'live', command: '@live', label: 'Live Voice Chat', description: 'Talk with Clora X like a call', icon: <Mic className="w-4 h-4" /> },
  { id: 'websearch', command: '@websearch', label: 'Web Search', description: 'Find real-time web info', icon: <Globe className="w-4 h-4" /> },
  { id: 'deepsearch', command: '@deepsearch', label: 'Deep Search', description: 'Search deeply across web and PDFs', icon: <Search className="w-4 h-4" /> },
  { id: 'image', command: '@image', label: 'Create Image', description: 'Generate an image from a prompt', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'file', command: '@file', label: 'Upload PDF / Audio / Video', description: 'Attach PDFs, images, audio, video and documents', icon: <Paperclip className="w-4 h-4" /> },
  { id: 'pdf', command: '@pdf', label: 'Ask PDF', description: 'Answer using uploaded PDFs', icon: <FileText className="w-4 h-4" /> },
];

interface ToolCommandPaletteProps {
  isOpen: boolean;
  searchQuery: string;
  onSelect: (command: CommandOption) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export function ToolCommandPalette({ isOpen, searchQuery, onSelect, onClose, position }: ToolCommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const filteredOptions = COMMAND_OPTIONS.filter(opt => 
    opt.command.toLowerCase().includes(searchQuery.toLowerCase()) || 
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredOptions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredOptions[selectedIndex]) {
          onSelect(filteredOptions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredOptions, selectedIndex, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="absolute z-50 w-full bg-white rounded-2xl shadow-2xl shadow-black/10 overflow-hidden border border-slate-200 p-1 left-0 bottom-full mb-2"
      
    >
      <div className="max-h-[300px] overflow-y-auto p-1 no-scrollbar">
        {filteredOptions.length === 0 ? (
          <div className="px-4 py-3 text-sm text-slate-500 text-center">No commands found</div>
        ) : (
          filteredOptions.map((opt, idx) => (
            <button
              key={opt.id}
              onClick={() => onSelect(opt)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                idx === selectedIndex ? 'bg-indigo-50 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className={`p-2 rounded-lg ${idx === selectedIndex ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                {opt.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold flex items-center gap-2">
                  {opt.label}
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${idx === selectedIndex ? 'bg-indigo-200/50 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                    {opt.command}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
