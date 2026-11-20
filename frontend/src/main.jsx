import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/app/App';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LangProvider } from '@/app/LangContext';
import { ToastProvider } from '@/app/ToastContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LangProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
