import React from 'react';

export function FocusTodoView() {
  return (
    <div className="w-full h-full min-h-full flex-1 flex flex-col bg-[#141415]">
      <iframe
        src="https://focustodo-five.vercel.app/"
        className="w-full h-full flex-1 border-none min-h-[calc(100dvh-64px)]"
        title="Focus To Do"
        allow="autoplay; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
