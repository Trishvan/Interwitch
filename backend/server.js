// Express server for AI Interview Assistant
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import { getFirestore } from 'firebase-admin/firestore';
import { exec } from 'child_process';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin SDK setup
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// Firestore database instance
const db = getFirestore();

// Auth middleware
async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Gemini API endpoint
app.post('/api/generate-questions', verifyToken, async (req, res) => {
  const { role = 'Full Stack React/Node', difficulty = ["Easy", "Medium", "Hard"], count = 6, candidate, previousQuestions = [] } = req.body;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    // Add candidate context and random string for uniqueness
    const candidateInfo = candidate ? `Candidate: ${candidate.name || ''}, Summary: ${candidate.summary || ''}, Chat: ${candidate.chat_history || ''}` : '';
    const randomizer = `Session: ${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    // Add previous questions to prompt to avoid repeats
    const avoidList = previousQuestions.length
      ? `Do NOT repeat or rephrase any of these questions: ${previousQuestions.map(q => `"${q}"`).join(', ')}.`
      : '';
    // Add extra prompt to discourage generic questions
    const extra = 'Do not include questions like: "What is React?", "What is virtual DOM?", or any other basic/generic questions. Make each question specific, scenario-based, and not easily found in tutorials.';
    const prompt = `Generate ${count} unique interview questions for a ${role} role. 2 Easy, 2 Medium, 2 Hard. Do NOT repeat questions from previous requests or use generic questions. Make each question specific and tailored to a real interview. ${candidateInfo}\n${randomizer}\n${avoidList}\n${extra}\nReturn as a JSON array with fields: level, question. No explanations, just the array.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    // Debug: log the raw Gemini response
    console.log('Gemini raw response:', JSON.stringify(response, null, 2));
    // Extract and parse Gemini response robustly
    let questions = [];
    let text = '';
    try {
      // Gemini SDK response structure
      text = response?.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
      // Remove code block markers if present
      text = text.replace(/^```json[\r\n]+|^```[\r\n]+|```$/gim, '').trim();
      questions = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', text);
    }
    // Remove time property from each question
    const safeQuestions = Array.isArray(questions)
      ? questions.map(({ time, ...q }) => q)
      : [];
    res.json({ questions: safeQuestions });
  } catch (err) {
    // Improved error logging
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'Failed to generate questions', details: err.message });
  }
});

// Get all user results
app.get('/api/results', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('results').get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(results);
  } catch (err) {
    console.error('Firestore get results error:', err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get a single user's results by UID
app.get('/api/results/:uid', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('results').doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('Firestore get user result error:', err);
    res.status(500).json({ error: 'Failed to fetch user result' });
  }
});

// Create/update a user's results (UID from auth)
app.post('/api/results', verifyToken, async (req, res) => {
  const { uid, email } = req.user;
  const { Easy = '', Medium = '', Hard = '' } = req.body;
  try {
    await db.collection('results').doc(uid).set({
      Email: String(email || ''),
      Easy: String(Easy),
      Medium: String(Medium),
      Hard: String(Hard)
    }, { merge: true });
    const doc = await db.collection('results').doc(uid).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('Firestore add/update result error:', err);
    res.status(500).json({ error: 'Failed to add/update result' });
  }
});

// Calculate score and summary after 6th question
app.post('/api/score-summary', verifyToken, async (req, res) => {
  const { uid, email } = req.user;
  const { answers = [], questions = [], name = '' } = req.body; // Accept name from frontend
  if (!Array.isArray(answers) || answers.length !== 6) {
    return res.status(400).json({ error: 'Must provide 6 answers' });
  }
  try {
    // Use Gemini to generate score and summary
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are an expert technical interviewer. Given the following 6 interview questions and the candidate's answers, do the following:\n\n1. Assign a final score (0-10) for the candidate's overall performance.\n2. Write a short, 2-3 sentence summary of the candidate's strengths and weaknesses.\n\nQuestions and Answers:\n${questions.map((q, i) => `Q${i+1}: ${q}\nA${i+1}: ${answers[i]}`).join('\n')}\n\nReturn a JSON object with fields: score, summary.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    let text = response?.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    text = text.replace(/^```json[\r\n]+|^```[\r\n]+|```$/gim, '').trim();
    let score = '', summary = '';
    try {
      const parsed = JSON.parse(text);
      score = String(parsed.score || '');
      summary = String(parsed.summary || '');
    } catch (e) {
      console.error('Failed to parse Gemini score/summary:', text);
    }
    // Save to Firestore, including name
    await db.collection('results').doc(uid).set({
      Email: String(email || ''),
      name: String(name || ''),
      score,
      summary,
      answers,
      questions
    }, { merge: true });
    res.json({ score, summary });
  } catch (err) {
    console.error('Gemini score/summary error:', err);
    res.status(500).json({ error: 'Failed to calculate score/summary', details: err.message });
  }
});

// Helper to check interviewer claim
function isInterviewerFromClaims(user) {
  return user.interviewer === true || (user.customClaims && user.customClaims.interviewer === true);
}

// Endpoint to get current user info and role (Firebase claim-based)
app.get('/api/me', verifyToken, (req, res) => {
  console.log('Decoded Firebase user:', req.user); // Debug log
  const { email, name, uid, interviewer, customClaims } = req.user;
  res.json({
    email,
    name,
    uid,
    isInterviewer: isInterviewerFromClaims(req.user)
  });
});

// Health check
app.get('/api/health', (req, res) => res.send('OK'));

// Add interviewer email to Firestore and set custom claim
app.post('/api/add-interviewer', verifyToken, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    // Add to Firestore collection with random doc ID
    await db.collection('interviewer').add({ email });
    // Run setInterviewerClaim.js with the email as argument
    exec(`node ./backend/setInterviewerClaim.js ${email}`, (error, stdout, stderr) => {
      if (error) {
        console.error('setInterviewerClaim.js error:', error, stderr);
        return res.status(500).json({ error: 'Failed to set interviewer claim', details: stderr });
      }
      console.log('setInterviewerClaim.js output:', stdout);
      res.json({ success: true, message: `Interviewer claim set for ${email}` });
    });
  } catch (err) {
    console.error('Error adding interviewer:', err);
    res.status(500).json({ error: 'Failed to add interviewer' });
  }
});

// Check if email is in interviewer collection (any doc with matching email field)
app.get('/api/check-interviewer', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ isInterviewer: false });
  try {
    const snapshot = await db.collection('interviewer').where('email', '==', email).get();
    res.json({ isInterviewer: !snapshot.empty });
  } catch (err) {
    res.status(500).json({ isInterviewer: false });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
