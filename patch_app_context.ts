import fs from 'fs';
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

code = code.replace(/const fetchUserDataFromDB = async \(rawEmail: string\) => \{([\s\S]*?)const docRef = doc\(db, 'users', email, 'progress', 'data'\);/g, 
`const fetchUserDataFromDB = async (rawEmail: string) => {$1
               if (auth?.currentUser && auth.currentUser.email && auth.currentUser.email.toLowerCase() !== email) {
                   console.warn("Skipping direct firestore read because auth.currentUser.email does not match requested email");
                   return;
               }
               const docRef = doc(db, 'users', email, 'progress', 'data');`);

code = code.replace(/if \(isFirebaseEnabled && db && auth\?\.currentUser\) \{\s*try \{\s*const docRef = doc\(db, 'users', user.email, 'progress', 'data'\);/g,
`if (isFirebaseEnabled && db && auth?.currentUser) {
       try {
          if (auth.currentUser.email && auth.currentUser.email.toLowerCase() !== user.email.toLowerCase()) {
              console.warn("Skipping direct firestore write because auth.currentUser.email does not match requested email");
              return;
          }
          const docRef = doc(db, 'users', user.email, 'progress', 'data');`);

fs.writeFileSync('src/context/AppContext.tsx', code);
