import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useSelector } from 'react-redux';
import { store, RootState } from './store';
import ChatbotUI from './components/ChatInterface';
import MemoryPage from './components/MemorySelection';
import RAGInterface from './components/RAGInterface';
import ModelInterface from './components/ModelInterface';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';

// Routes component
const AppRoutes: React.FC = () => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

      {/* Protected routes */}
      <Route element={<PrivateRoute />}>
        <Route path="/" element={<ChatbotUI />} />
        <Route path="/chat" element={<ChatbotUI />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="/rag" element={<RAGInterface />} />
        <Route path="/model" element={<ModelInterface />} />
      </Route>

      {/* Catch all other routes and redirect to login or home */}
      <Route path="*" element={isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <Router>
        <AppRoutes />
      </Router>
    </Provider>
  );
};

export default App;
