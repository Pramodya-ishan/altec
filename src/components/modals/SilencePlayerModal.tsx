import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';

export function SilencePlayerModal() {
  const { modals, setModals } = useApp();
  const { open, videoUrl, title } = modals.silencePlayer;
  const [iframeSrc, setIframeSrc] = useState('');

  useEffect(() => {
    if (open && videoUrl) {
      if (videoUrl.startsWith('localdb://')) {
        const id = videoUrl.replace('localdb://', '');
        setIframeSrc(`/local-player/index.html?id=${id}`);
      } else if (videoUrl.startsWith('blob:')) {
        setIframeSrc(`/local-player/index.html?blob=${encodeURIComponent(videoUrl)}`);
      } else {
        setIframeSrc(`/local-player/index.html`); // fallback
      }
    } else {
      setIframeSrc('');
    }
  }, [open, videoUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4">
      <button 
         onClick={() => setModals(prev => ({ ...prev, silencePlayer: { open: false, videoUrl: '', title: '' } }))}
         className="absolute top-4 right-4 z-50 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-xl transition-all"
      >
         <i className="fa-solid fa-xmark"></i>
      </button>
      {iframeSrc && (
         <iframe 
            src={iframeSrc} 
            className="w-full h-full max-w-6xl max-h-[85vh] rounded-2xl shadow-2xl border border-white/10 bg-[#07080a]"
            allow="autoplay; fullscreen"
         />
      )}
    </div>
  );
}
