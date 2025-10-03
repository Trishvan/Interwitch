// setInterviewerClaim.js
// Usage: node setInterviewerClaim.js <email>
// Make sure GOOGLE_APPLICATION_CREDENTIALS is set to your Firebase service account JSON

import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Firebase Admin if not already initialized
try {
  admin.app();
} catch (e) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

// Get email from command-line argument (only needed for setInterviewerClaim)
const email = process.argv[2];

async function setInterviewerClaim() {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { interviewer: true });
    console.log(`Set interviewer claim for ${email}`);
  } catch (err) {
    console.error('Error setting claim:', err);
  }
}

// Utility: Print all docs in a collection
async function printCollection(name) {
  const db = admin.firestore();
  const snapshot = await db.collection(name).get();
  console.log(`\nCollection: ${name}`);
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}

// If run with --list, print both collections and exit
if (process.argv.includes('--list')) {
  (async () => {
    await printCollection('intervierwer');
    await printCollection('results');
    process.exit(0);
  })();
} else {
  if (!email) {
    console.error('Usage: node setInterviewerClaim.js <email>');
    process.exit(1);
  }
  setInterviewerClaim();
}
