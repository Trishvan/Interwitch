import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  current: null, // Current interview session
  status: 'idle', // idle | running | paused | finished
  progress: 0, // Question index
  answers: [], // Array of answers
  questions: [], // Array of questions
  timer: null, // Current timer value
};

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    startInterview(state, action) {
      state.current = action.payload;
      state.status = 'running';
      state.progress = 0;
      state.answers = [];
      state.questions = action.payload.questions || [];
      state.timer = null;
    },
    answerQuestion(state, action) {
      state.answers[state.progress] = action.payload;
    },
    nextQuestion(state) {
      state.progress += 1;
      state.timer = null;
    },
    setTimer(state, action) {
      state.timer = action.payload;
    },
    pauseInterview(state) {
      state.status = 'paused';
    },
    resumeInterview(state) {
      state.status = 'running';
    },
    finishInterview(state) {
      state.status = 'finished';
    },
    resetInterview(state) {
      return initialState;
    },
  },
});

export const { startInterview, answerQuestion, nextQuestion, setTimer, pauseInterview, resumeInterview, finishInterview, resetInterview } = interviewSlice.actions;
export default interviewSlice.reducer;
