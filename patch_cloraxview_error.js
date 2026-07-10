import fs from 'fs';

let content = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

const regexErrorBlock = /\{\/\* Error Block \*\/\}\s*\{error && isStreamingActive && \([\s\S]*?\}\)/;

const newErrorBlock = `{/* Error Block */}
                            {error && isStreamingActive && (
                              <div className="text-rose-600 font-semibold text-xs p-3.5 bg-rose-50 rounded-xl mb-2 border border-rose-100 flex items-start gap-2 shadow-2xs">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <div>
                                  <p>{error}</p>
                                  {(error.includes("credits") || error.includes("අවසන්") || error.includes("Billing")) ? (
                                    <div className="mt-2">
                                      <p className="text-[10px] text-rose-500/80 mb-2">Local features are still available without AI.</p>
                                      <div className="flex flex-wrap gap-2">
                                        <button onClick={() => setInput("give all pdfs you have")} className="px-2 py-1 bg-white border border-rose-200 rounded shadow-xs active:scale-95 transition-transform text-rose-700">List PDFs</button>
                                        <button onClick={() => setInput("2024 SFT Q1")} className="px-2 py-1 bg-white border border-rose-200 rounded shadow-xs active:scale-95 transition-transform text-rose-700">Check Cache</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-rose-500/80 mt-0.5">Please check network connection or retry.</p>
                                  )}
                                </div>
                              </div>
                            )}`;

content = content.replace(regexErrorBlock, newErrorBlock);

fs.writeFileSync('src/components/views/CloraXView.tsx', content);
