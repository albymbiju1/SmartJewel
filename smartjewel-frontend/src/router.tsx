import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { App } from './pages/App';
import { LandingPage } from './pages/LandingPage';

export const AppRouter: React.FC = () => (
  <Router>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<App />} />
      <Route path="/register" element={<App />} />
    </Routes>
  </Router>
);
