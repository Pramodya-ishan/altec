import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, Link2, PlayCircle, Loader2 } from 'lucide-react';
import { storage } from '../../lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

interface VoiceAudioCardProps {
  storagePath?: string;
  audioUrl?: string;
  provider?: string;
  voiceName?: string;
  chars?: number;
}

export function VoiceAudioCard({ storagePath, audioUrl: initialAudioUrl, provider, voiceName, chars }: VoiceAudioCardProps) {
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl || '');
  const [loading, setLoading] = useState(!initialAudioUrl && !!storagePath);

  useEffect(() => {
    if (!audioUrl && storagePath) {
      getDownloadURL(ref(storage, storagePath))
        .then(url => {
          setAudioUrl(url);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load audio URL:", err);
          setLoading(false);
        });
    }
  }, [storagePath, audioUrl]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading voice audio...
      </div>
    );
  }

  if (!audioUrl) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 my-2 max-w-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-indigo-500" /> Generated Voice
          </div>
          {(provider || voiceName || chars) && (
            <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">
              {provider} • {voiceName} • {chars ? `${chars} chars` : ''}
            </div>
          )}
        </div>
      </div>
      <audio controls src={audioUrl} className="w-full h-10" />
      <div className="flex items-center gap-2 mt-3 justify-end">
        <a href={audioUrl} target="_blank" rel="noreferrer" className="p-2 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full cursor-pointer transition-colors" title="Open in new tab">
          <ExternalLink className="w-4 h-4" />
        </a>
        <button onClick={() => {
          navigator.clipboard.writeText(audioUrl);
          alert("Link copied!");
        }} className="p-2 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full cursor-pointer transition-colors" title="Copy link">
          <Link2 className="w-4 h-4" />
        </button>
        <a href={audioUrl} download="voice.mp3" className="p-2 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full cursor-pointer transition-colors" title="Download MP3">
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
