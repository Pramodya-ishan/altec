import fs from 'fs';
let code = fs.readFileSync('src/components/views/CloraXView.tsx', 'utf-8');

const effect = `
  useEffect(() => {
    const handleSend = (e: any) => {
      setInput(e.detail);
      // Wait for state to update, then submit
      setTimeout(() => {
         const form = document.getElementById("clora-form");
         if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }, 50);
    };
    window.addEventListener('clora-send', handleSend);
    return () => window.removeEventListener('clora-send', handleSend);
  }, []);
`;

code = code.replace(/const fileInputRef = useRef<HTMLInputElement>\(null\);/, "const fileInputRef = useRef<HTMLInputElement>(null);\n" + effect);

code = code.replace(/<form onSubmit=\{handleSubmit\}/, '<form id="clora-form" onSubmit={handleSubmit}');

fs.writeFileSync('src/components/views/CloraXView.tsx', code);
