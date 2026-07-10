import fs from 'fs';

// fix PaperStructureView.tsx
let p = fs.readFileSync('src/components/views/PaperStructureView.tsx', 'utf8');
p = p.replace(
  /useState<Record<string, boolean>>\(\(\) => \{\s*return \{\s*mcq: data\.collapsedStates\?.paperStructure_mcq \?\? false,\s*partA: data\.collapsedStates\?.paperStructure_partA \?\? false,\s*partBCD: data\.collapsedStates\?.paperStructure_partBCD \?\? false,\s*\};\s*\}\s*useEffect/g,
  "useState<Record<string, boolean>>(() => {\n   return {\n     mcq: data.collapsedStates?.paperStructure_mcq ?? false,\n     partA: data.collapsedStates?.paperStructure_partA ?? false,\n     partBCD: data.collapsedStates?.paperStructure_partBCD ?? false,\n   };\n  });\n\n  useEffect"
);

p = p.replace(
  /useEffect\(\(\) => \{\s*setCollapsedSections\(\{\s*mcq: data\.collapsedStates\?.paperStructure_mcq \?\? false,\s*partA: data\.collapsedStates\?.paperStructure_partA \?\? false,\s*partBCD: data\.collapsedStates\?.paperStructure_partBCD \?\? false,\s*\}\s*\},/g,
  "useEffect(() => {\n   setCollapsedSections({\n     mcq: data.collapsedStates?.paperStructure_mcq ?? false,\n     partA: data.collapsedStates?.paperStructure_partA ?? false,\n     partBCD: data.collapsedStates?.paperStructure_partBCD ?? false,\n   });\n  },"
);

fs.writeFileSync('src/components/views/PaperStructureView.tsx', p);
