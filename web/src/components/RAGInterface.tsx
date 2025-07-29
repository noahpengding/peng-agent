import React, { useState, useEffect } from 'react';
import { useRAGApi, RAGDocument } from '../hooks/RAGAPI';
import { useNavigate } from 'react-router-dom';
import './RAGInterface.css';

const RAGInterface: React.FC = () => {
  // State for RAG documents and filters
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<RAGDocument[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<string[]>([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // State for adding new documents
  const [filePath, setFilePath] = useState<string>('');
  const [collectionName, setCollectionName] = useState<string>('');
  const [typeOfFile, setTypeOfFile] = useState<'standard' | 'handwriting'>('standard');
  const [indexResult, setIndexResult] = useState<string>('');

  // Get API functions and state
  const { getAllRAGDocuments, indexDocument, isLoading } = useRAGApi();
  // Add navigate for routing
  const navigate = useNavigate();

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Extract unique knowledge bases from documents
  useEffect(() => {
    if (documents.length > 0) {
      const uniqueKnowledgeBases = Array.from(new Set(documents.map((doc) => doc.knowledge_base)));
      setKnowledgeBases(uniqueKnowledgeBases);
    }
  }, [documents]);

  // Filter documents when filter changes
  useEffect(() => {
    if (selectedKnowledgeBase) {
      setFilteredDocuments(documents.filter((doc) => doc.knowledge_base === selectedKnowledgeBase));
    } else {
      setFilteredDocuments(documents);
    }
  }, [selectedKnowledgeBase, documents]);

  // Load all documents from API
  const loadDocuments = async () => {
    try {
      const docs = await getAllRAGDocuments();
      setDocuments(docs);
      setFilteredDocuments(docs);
    } catch (err) {
      setError(`Failed to load RAG documents: ${err}`);
    }
  };

  // Handle indexing a new document
  const handleIndexDocument = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!filePath.trim() || !collectionName.trim()) {
      return;
    }

    setIndexResult('Loading...');

    try {
      const result = await indexDocument('peng', filePath, collectionName, typeOfFile);
      setIndexResult(result);

      // Reload the documents to show the newly added one
      loadDocuments();

      // Clear form fields
      setFilePath('');
      setCollectionName('');
      setTypeOfFile('standard');
    } catch (err) {
      setIndexResult(err instanceof Error ? err.message : 'Failed to index document');
    }
  };

  return (
    <div className="rag-container">
      {/* Header */}
      <header className="header">
        <h1 className="header-title">RAG Collection Management</h1>
        {error && <div className="error-message">{error}</div>}
      </header>

      <div className="main-content">
        {/* Sidebar for controls */}
        <div className="sidebar">
          {/* Home button */}
          <button className="home-button" onClick={() => navigate('/')}>
            Return to Home
          </button>

          <h2 className="sidebar-title">Add New Document</h2>

          <form onSubmit={handleIndexDocument} className="form">
            <div className="form-group">
              <label className="form-label">File Path</label>
              <input
                type="text"
                className="form-input"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="Enter file path"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Knowledge Base</label>
              <input
                type="text"
                className="form-input"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Enter knowledge base name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">File Type</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="typeOfFile"
                    value="standard"
                    checked={typeOfFile === 'standard'}
                    onChange={(e) => setTypeOfFile(e.target.value as 'standard' | 'handwriting')}
                    className="radio-input"
                  />
                  Standard
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="typeOfFile"
                    value="handwriting"
                    checked={typeOfFile === 'handwriting'}
                    onChange={(e) => setTypeOfFile(e.target.value as 'standard' | 'handwriting')}
                    className="radio-input"
                  />
                  Handwriting
                </label>
              </div>
            </div>

            <button type="submit" className="index-button" disabled={isLoading || !filePath.trim() || !collectionName.trim()}>
              Index Document
            </button>
          </form>

          {indexResult && (
            <div className="index-result">
              <h3>Result:</h3>
              <p>{indexResult}</p>
            </div>
          )}

          <div className="filters">
            <h3 className="filter-title">Filters</h3>

            <div className="form-group">
              <label className="form-label">Knowledge Base</label>
              <select className="form-select" value={selectedKnowledgeBase} onChange={(e) => setSelectedKnowledgeBase(e.target.value)}>
                <option value="">All Knowledge Bases</option>
                {knowledgeBases.map((kb) => (
                  <option key={kb} value={kb}>
                    {kb}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main area for documents table */}
        <div className="documents-area">
          <div className="documents-header">
            <h2>Available RAG Documents</h2>
            <button className="refresh-button" onClick={loadDocuments} disabled={isLoading}>
              Refresh
            </button>
          </div>

          {isLoading && !indexResult ? (
            <div className="loading">Loading documents...</div>
          ) : (
            <div className="table-container">
              <table className="documents-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Knowledge Base</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length > 0 ? (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.user_name}</td>
                        <td>{doc.knowledge_base}</td>
                        <td>{doc.title}</td>
                        <td>{doc.type}</td>
                        <td>{doc.path}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="no-documents">
                        No documents found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RAGInterface;
