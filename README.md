# AI Interview Assistant

This is a React (JavaScript) Vite app for an AI-powered interview assistant. It features:

- Interviewee (Chat): Resume upload (PDF/DOCX), field extraction, chat-based interview, timed questions, and progress persistence.
- Interviewer (Dashboard): Candidate list ordered by score, detailed view of chat history, profile, and AI summary, with search and sort.
- Local persistence: All progress, answers, timers, and candidate data are saved locally and restored on refresh/reopen. Includes a "Welcome Back" modal for unfinished sessions.
- Modern UI: Built with Ant Design, Redux Toolkit, and redux-persist for state management and friendly error handling.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

## Tech Stack
- React
- Vite
- Redux Toolkit & redux-persist
- Ant Design
- PDF/DOCX parsing libraries

## Project Structure
- Interviewee Tab: Chat flow, resume upload, question/answer, timers
- Interviewer Tab: Dashboard, candidate list, details, search/sort

## License
MIT
