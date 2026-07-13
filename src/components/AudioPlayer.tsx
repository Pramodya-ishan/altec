import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, X } from 'lucide-react';

export const AudioPlayer = ({ url, onClose }: { url: string, onClose: () => void }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Auto-play prevented", e));
    }
  }, [url]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(100);
  };

  return (
    <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg border border-gray-700 w-[300px]">
      <button onClick={togglePlay} className="p-2 hover:bg-gray-800 rounded-full transition-colors flex-shrink-0">
        {isPlaying ? <Pause className="w-5 h-5 text-blue-400" /> : <Play className="w-5 h-5 text-blue-400" />}
      </button>
      
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden relative">
        <div 
          className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-100" 
          style={{ width: `${progress}%` }} 
        />
      </div>
      
      <Volume2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
      
      <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full transition-colors flex-shrink-0 ml-1">
        <X className="w-4 h-4 text-gray-400 hover:text-white" />
      </button>

      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className="hidden" 
      />
    </div>
  );
};
