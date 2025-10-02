// Express server for AI Interview Assistant
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import { getFirestore } from 'firebase-admin/firestore';
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

// Example: Get candidates
app.get('/api/candidates', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('candidates').orderBy('score', 'desc').get();
    const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(candidates);
  } catch (err) {
    console.error('Firestore get candidates error:', err);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// Example: Add candidate (from authenticated user)
app.post('/api/candidates', verifyToken, async (req, res) => {
  // Use authenticated user info for candidate
  const { name, email, uid } = req.user;
  const { phone, score, summary, chat_history } = req.body;
  try {
    const docRef = await db.collection('candidates').add({
      name: name || '',
      email: email || '',
      uid: uid || '',
      phone,
      score,
      summary,
      chat_history
    });
    const doc = await docRef.get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('Firestore add candidate error:', err);
    res.status(500).json({ error: 'Failed to add candidate' });
  }
});

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

// Add results endpoint to Firestore
app.post('/api/results', verifyToken, async (req, res) => {
  const { candidateId, results } = req.body;
  try {
    // Store results under a 'results' collection, with candidateId as a field
    const docRef = await db.collection('results').add({ candidateId, results, createdAt: new Date() });
    const doc = await docRef.get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('Firestore add results error:', err);
    res.status(500).json({ error: 'Failed to add results' });
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
