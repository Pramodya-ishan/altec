import fs from 'fs';
let p = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

// Inside CloraXView component
p = p.replace(
  /const \[isVoiceFeedbackEnabled, setIsVoiceFeedbackEnabled\] = useState\(false\);/,
  `const [isVoiceFeedbackEnabled, setIsVoiceFeedbackEnabled] = useState(false);
  const [isTtsAvailable, setIsTtsAvailable] = useState(true);

  useEffect(() => {
    fetch('/api/ai/model-health')
      .then(r => r.json())
      .then(data => {
        if (data && data.models && data.models.tts && data.models.tts.available === false) {
          setIsTtsAvailable(false);
          setIsVoiceFeedbackEnabled(false);
        }
      })
      .catch(err => console.error("Health check failed", err));
  }, []);`
);

p = p.replace(
  /\{isSpeaking \? \(/g,
  `{isTtsAvailable && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        setIsVoiceFeedbackEnabled(!isVoiceFeedbackEnabled);
                      }
                    }}
                    className={\`p-3 rounded-2xl transition-all \${
                      isSpeaking 
                        ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                        : isVoiceFeedbackEnabled 
                          ? 'bg-slate-200 text-slate-800 hover:bg-slate-300' 
                          : 'bg-transparent text-slate-400 hover:bg-slate-100'
                    }\`}
                    title={isSpeaking ? "Stop Speaking" : isVoiceFeedbackEnabled ? "Voice Output Active" : "Enable Voice Output"}
                    aria-label="Voice Output Control"
                  >
                    {isSpeaking ? (
                      <Volume2 className="w-5 h-5" />
                    ) : isVoiceFeedbackEnabled ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </button>
                )}
                {/* Replaced button logic */ false && (`
);

p = p.replace(
  /<\/button>\s*<\/div>\s*<div className="flex items-center pr-1">/g,
  `</button>)}
              </div>
              <div className="flex items-center pr-1">`
);

fs.writeFileSync('src/components/views/CloraXView.tsx', p);
