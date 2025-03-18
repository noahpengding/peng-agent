import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ChatbotUI from './components/ChatInterface';
import MemoryPage from './components/MemorySelection';
import RAGInterface from './components/RAGInterface';
import ModelInterface from './components/ModelInterface';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatbotUI />} />
        <Route path="/chat" element={<ChatbotUI />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="/rag" element={<RAGInterface />} />
        <Route path="/model" element={<ModelInterface />} />
      </Routes>
    </Router>
  );
};

export default App;
