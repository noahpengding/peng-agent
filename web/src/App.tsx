import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ChatbotUI from './components/ChatInterface';
import MemoryPage from './components/MemorySelection';
import RAGInterface from './components/RAGInterface';
import ModelInterface from './components/ModelInterface';
import { API_BASE_URL, test } from "./config/config";

console.log("Backend URL:", test);
console.log("Backend URL:", API_BASE_URL);

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
