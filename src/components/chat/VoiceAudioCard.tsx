import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, Link2, PlayCircle, Loader2 } from 'lucide-react';
import { storage } from '../../lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { useApp } from '../../context/AppContext';

interface VoiceAudioCardProps {
  storagePath?: string;
  audioUrl?: string;
  provider?: string;
  voiceName?: string;
  chars?: number;
}

export function VoiceAudioCard({ storagePath, audioUrl: initialAudioUrl, provider, voiceName, chars }: VoiceAudioCardProps) {
  const { showNotification } = useApp();
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
            <div className="mt-1 text-xs font-semibold uppercase text-slate-500">
              {provider} • {voiceName} • {chars ? `${chars} chars` : ''}
            </div>
          )}
        </div>
      </div>
      <audio controls src={audioUrl} className="w-full h-10" />
      <div className="flex items-center gap-2 mt-3 justify-end">
        <a href={audioUrl} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700" title="Open in new tab" aria-label="Open voice audio in a new tab">
          <ExternalLink className="w-4 h-4" />
        </a>
        <button type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(audioUrl);
            showNotification("Voice link copied.", "success");
          } catch {
            showNotification("The voice link could not be copied.", "error");
          }
        }} className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700" title="Copy link" aria-label="Copy voice audio link">
          <Link2 className="w-4 h-4" />
        </button>
        <a href={audioUrl} download="voice.mp3" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700" title="Download MP3" aria-label="Download voice audio">
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
