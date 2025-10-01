import React from 'react';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import 'antd/dist/reset.css';
import { store, persistor } from './store';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </StrictMode>,
);
