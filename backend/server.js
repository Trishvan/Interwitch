// Express server for AI Interview Assistant
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import admin from 'firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin SDK setup
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
  const result = await pool.query('SELECT * FROM candidates ORDER BY score DESC');
  res.json(result.rows);
});

// Example: Add candidate
app.post('/api/candidates', verifyToken, async (req, res) => {
  const { name, email, phone, score, summary, chat_history } = req.body;
  const result = await pool.query(
    'INSERT INTO candidates (name, email, phone, score, summary, chat_history) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [name, email, phone, score, summary, chat_history]
  );
  res.json(result.rows[0]);
});

// Gemini API endpoint
app.post('/api/generate-questions', verifyToken, async (req, res) => {
  const { role = 'Full Stack React/Node', difficulty = ["Easy", "Medium", "Hard"], count = 6, candidate } = req.body;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Generate ${count} interview questions for a ${role} role. 2 Easy, 2 Medium, 2 Hard. Return as JSON array with fields: level, question.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    // Debug: log the raw Gemini response
    console.log('Gemini raw response:', JSON.stringify(response, null, 2));
    // Parse Gemini response
    let questions = [];
    if (response && response.text) {
      try {
        questions = JSON.parse(response.text);
      } catch (e) {
        console.error('Failed to parse Gemini response as JSON:', response.text);
      }
    }
    res.json({ questions });
  } catch (err) {
    // Improved error logging
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'Failed to generate questions', details: err.message });
  }
});

// Helper to check interviewer claim
function isInterviewerFromClaims(user) {
  return user.interviewer === true || (user.customClaims && user.customClaims.interviewer === true);
}

// Endpoint to get current user info and role (Firebase claim-based)
app.get('/api/me', verifyToken, (req, res) => {
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
