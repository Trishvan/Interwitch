import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: [], // Array of candidates
  selectedId: null, // For dashboard detail view
};

const candidateSlice = createSlice({
  name: 'candidates',
  initialState,
  reducers: {
    addCandidate(state, action) {
      state.list.push(action.payload);
    },
    updateCandidate(state, action) {
      const idx = state.list.findIndex(c => c.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
    },
    selectCandidate(state, action) {
      state.selectedId = action.payload;
    },
    resetCandidates(state) {
      state.list = [];
      state.selectedId = null;
    },
  },
});

export const { addCandidate, updateCandidate, selectCandidate, resetCandidates } = candidateSlice.actions;
export default candidateSlice.reducer;
