import fs from 'fs';
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

code = code.replace(/const notifCollectionRef = collection\(db, 'users', email, 'notifications'\);/g, 
`if (auth?.currentUser && auth.currentUser.email && auth.currentUser.email.toLowerCase() !== email.toLowerCase()) {
          console.warn("Skipping direct firestore notification read because auth.currentUser.email does not match requested email");
          return;
        }
        const notifCollectionRef = collection(db, 'users', email, 'notifications');`);

fs.writeFileSync('src/context/AppContext.tsx', code);
