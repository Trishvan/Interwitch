// setInterviewerClaim.js
// Usage: node setInterviewerClaim.js
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

// Replace with the email of the user you want to make an interviewer
const email = 'interviewer1@example.com'; // <-- CHANGE THIS

async function setInterviewerClaim() {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { interviewer: true });
    console.log(`Set interviewer claim for ${email}`);
  } catch (err) {
    console.error('Error setting claim:', err);
  }
}

setInterviewerClaim();
