import fs from 'fs';
let content = fs.readFileSync('firestore.rules', 'utf8');

const oldRules = `    match /knowledge_sources/{sourceId} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /knowledge_chunks/{chunkId} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }`;

const newRules = `    match /ragSources/{sourceId} {
      allow read: if signedIn() && (resource.data.uploadedByUid == request.auth.uid || resource.data.sourceType != 'note' || isAdmin());
      allow write: if signedIn() && (resource.data.uploadedByUid == request.auth.uid || isAdmin());
      allow create: if signedIn();
    }
    match /ragChunks/{chunkId} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /ragJobs/{jobId} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }`;

content = content.replace(oldRules, newRules);
fs.writeFileSync('firestore.rules', content);
