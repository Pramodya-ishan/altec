import fs from 'fs';
let content = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

content = content.replace(
  'const { answer, status, isStreaming, safeSummary, error, sendAIMessage, cancel } = useAIWorkflowStream();',
  'const { answer, status, isStreaming, safeSummary, sources, error, sendAIMessage, cancel } = useAIWorkflowStream();'
);

content = content.replace(
  `{answer && (
                <div className="prose prose-invert max-w-none text-gray-300">
                  <Markdown>{answer}</Markdown>`,
  `{answer && (
                <div className="prose prose-invert max-w-none text-gray-300">
                  <Markdown>{answer}</Markdown>
                  
                  {sources && sources.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-700/50">
                      <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5" />
                        Sources Used
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sources.map((src, i) => (
                          <div key={i} className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-2.5 flex items-start gap-2">
                            <div className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5">
                              {src.sourceType}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-200 truncate">{src.title}</div>
                              <div className="text-xs text-gray-500 truncate mt-0.5">
                                {src.lesson ? src.lesson + " • " : ""}{src.page ? (src.page + " • ") : ""}conf {Math.round((src.confidence || 0) * 100)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}`
);

fs.writeFileSync('src/components/views/CloraXView.tsx', content);
