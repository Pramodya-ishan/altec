import fs from 'fs';

let p = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf8');

p = p.replace(
  /                            \)}[\s\n]*<\/div>[\s\n]*<\/div>[\s\n]*\)}[\s\n]*<\/motion\.div>/g,
  `                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>`
);

fs.writeFileSync('src/components/views/CloraXView.tsx', p);
