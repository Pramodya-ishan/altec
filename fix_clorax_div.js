import fs from 'fs';

let p = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

p = p.replace(
  /                            \)}[\s\n]*<\/div>[\s\n]*\)}[\s\n]*<\/div>[\s\n]*<\/div>/g,
  `                            )}
                          </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>`
);

fs.writeFileSync('src/components/views/CloraXView.tsx', p);
