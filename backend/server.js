// Express server for AI Interview Assistant
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import admin from 'firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';
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
    // Call Gemini API (replace with your actual Gemini endpoint and key)
    const geminiRes = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      {
        contents: [{
          parts: [{
            text: `Generate ${count} interview questions for a ${role} role. 2 Easy, 2 Medium, 2 Hard. Return as JSON array with fields: level, question.`
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
        }
      }
    );
    // Parse Gemini response
    const questions = JSON.parse(geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
    res.json({ questions });
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// Health check
app.get('/api/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
