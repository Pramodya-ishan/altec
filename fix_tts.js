import fs from 'fs';
let p = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

const regex = /\{\/\* TTS Voice Feedback Control Toggle \*\/\}[\s\S]*?<\/button>\s*\{\/\* Replaced button logic \*\/ false && \([\s\S]*?<\/button>\s*\)\}\s*<\/div>/;

// wait, I already removed the `{/* Replaced button logic */...` 
// Let's just find the closing `</button>` for TTS Toggle.

const buttonStart = `                {/* TTS Voice Feedback Control Toggle */}
                <button`;

const targetRegex = /\{\/\* TTS Voice Feedback Control Toggle \*\/\}[\s\S]*?<\/button>/;

p = p.replace(targetRegex, `{/* TTS Voice Feedback Control Toggle */}
                {isTtsAvailable && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        setIsVoiceFeedbackEnabled(!isVoiceFeedbackEnabled);
                      }
                    }}
                    className={\`w-10 h-10 flex items-center justify-center transition-all duration-200 rounded-full shrink-0 cursor-pointer \${
                      isSpeaking 
                        ? "bg-amber-100 text-amber-600 animate-pulse" 
                        : isVoiceFeedbackEnabled 
                          ? "text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100" 
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
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
                )}`);

fs.writeFileSync('src/components/views/CloraXView.tsx', p);
