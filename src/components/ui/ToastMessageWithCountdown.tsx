import React, { useState, useEffect } from 'react';

export function ToastMessageWithCountdown({ message, retryAfter }: { message: string, retryAfter?: number }) {
  const [timeLeft, setTimeLeft] = useState(retryAfter || 0);

  useEffect(() => {
    if (!retryAfter || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryAfter]);

  if (!retryAfter) {
    return <span>{message}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <span>{message}</span>
      {timeLeft > 0 ? (
        <span className="text-xs bg-black/20 text-white/90 px-2 py-1 rounded-md max-w-fit flex items-center gap-1.5">
          <i className="fa-solid fa-clock opacity-70"></i> Retry in {timeLeft} seconds...
        </span>
      ) : (
        <span className="text-xs text-white/90 font-medium">Ready to retry!</span>
      )}
    </div>
  );
}
