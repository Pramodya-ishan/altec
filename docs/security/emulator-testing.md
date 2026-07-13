# Firebase Emulator Suite Testing

This document provides instructions for setting up, starting, and running automated tests against the Firebase Local Emulator Suite.

## 1. Prerequisites

To run the emulators locally, you must have the following installed:
- Node.js (v18 or higher)
- Java SE Development Kit (JDK 11 or higher - required for Firebase Emulators)
- Firebase CLI (`npm install -g firebase-tools`)

## 2. Configuration files

The project contains pre-configured Firebase environment files at the root:
- `firebase.json`: Configures the Firestore, Auth, and Storage emulator ports.
- `firestore.rules`: Defines the security rules validated during the emulator run.
- `storage.rules`: Defines the storage bucket permissions.

## 3. Launching the Emulators

To boot the entire local emulator environment, run:
```bash
firebase emulators:start
```

This starts:
- **Firestore Emulator**: Port `8080`
- **Auth Emulator**: Port `9099`
- **Storage Emulator**: Port `9199`
- **Firebase Emulator UI**: Port `4000` (Open `http://localhost:4000` in your browser to view live data and trigger auth scenarios)

## 4. Running Automated Rules Tests

We have written integrated test suites to assert that rule restrictions function correctly.
To run the automated rules assertions:

1. In a separate terminal, start the emulators:
   ```bash
   firebase emulators:start
   ```
2. Run the security verification suite:
   ```bash
   npm run verify
   ```
3. Run the custom role-capability and codebase scanner:
   ```bash
   npx tsx scripts/run-security-tests.ts
   ```
