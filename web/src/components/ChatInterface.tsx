import React, { useState, useEffect, useRef } from 'react';
import { useChatApi } from '../hooks/ChatAPI';
import { Memory } from '../hooks/MemoryAPI';
import { useRAGApi } from '../hooks/RAGAPI';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import './ChatInterface.css';
import { apiCall } from '../utils/apiUtils';

// Define interfaces for model objects
interface ModelInfo {
  id: string;
  operator: string;
  type: string;
  model_name: string;
  isAvailable: boolean;
}

// Main App Component
const ChatbotUI = () => {
  // State for chat input and messages
  const [input, setInput] = useState('');
  interface Message {
    role: string;
    content: string;
    image?: string;
  }
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Create ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref for textarea to focus after certain actions
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Initialize the chat API hook
  const { sendMessage, error: apiError } = useChatApi();
  // Initialize the RAG API hook
  const { getAllRAGDocuments, isLoading: ragLoading, error: ragError } = useRAGApi();
  // Get authentication context
  const { user } = useAuth();
  
  // State for available knowledge bases
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<string[]>(['default']);
  // State for available base models
  const [availableBaseModels, setAvailableBaseModels] = useState<ModelInfo[]>([]);
  // Loading states for model lists
  const [baseModelsLoading, setBaseModelsLoading] = useState(false);
  
  // Map UI selections to backend config
  useEffect(() => {
    if (apiError) {
      setError(`API Error: ${apiError}`);
    }
    
    if (ragError) {
      setError(`RAG API Error: ${ragError}`);
    }
  }, [apiError, ragError]);

  // Fetch available knowledge bases on component mount
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        const ragDocuments = await getAllRAGDocuments();
        // Extract unique knowledge base names
        const uniqueKnowledgeBases = Array.from(
          new Set(ragDocuments.map(doc => doc.knowledge_base))
        );
        
        // Add default option if no knowledge bases found
        if (uniqueKnowledgeBases.length > 0) {
          setAvailableKnowledgeBases(['default', ...uniqueKnowledgeBases]);
        }
      } catch (err) {
        setError(`Error fetching knowledge bases: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    fetchKnowledgeBases();
  }, []);

  // Fetch available base models on component mount
  useEffect(() => {
    const fetchAvailableModels = async () => {
      // Fetch base models
      setBaseModelsLoading(true);
      try {
        const data = await apiCall('POST', '/avaliable_model', { type: "base" });
        
        if (Array.isArray(data) && data.length > 0) {
          setAvailableBaseModels(data);
          // Set default to first available model's model_name
          setbaseModel(data[0].model_name);
        }
      } catch (error) {
        setError(`Failed to fetch base models: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to default models as simple strings to maintain compatibility
        setAvailableBaseModels([
          { id: "1", operator: "openai", type: "base", model_name: "gpt-4", isAvailable: true },
          { id: "2", operator: "openai", type: "base", model_name: "gpt-3.5-turbo", isAvailable: true },
          { id: "3", operator: "anthropic", type: "base", model_name: "claude-3-opus", isAvailable: true },
          { id: "4", operator: "anthropic", type: "base", model_name: "claude-3-sonnet", isAvailable: true }
        ]);
      } finally {
        setBaseModelsLoading(false);
      }
    };
    
    fetchAvailableModels();
  }, []);

  // State for backend config
  const [username, setUsername] = useState('default_user');
  
  // Update username from auth context when available
  useEffect(() => {
    if (user) {
      setUsername(user);
    }
  }, [user]);

  // Legacy state for UI components
  const [baseModel, setbaseModel] = useState('gpt-4');
  const [knowledgeBase, setKnowledgeBase] = useState('default');
  const [contextWindow, setContextWindow] = useState(8192);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [shortTermMemory, setShortTermMemory] = useState<string[]>([]);
  const [longTermMemory] = useState([]);

  // Load any selected memories from localStorage on component mount
  useEffect(() => {
    const savedMemories = localStorage.getItem('selectedMemories');
    if (savedMemories) {
      try {
        const parsedMemories: Memory[] = JSON.parse(savedMemories);
        setShortTermMemory(parsedMemories.map(memory => memory.ai_response));
        // Optionally clear localStorage after loading
        localStorage.removeItem('selectedMemories');
      } catch (error) {
        setError(`Error parsing saved memories: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }, []);

  // Function to determine operator based on model name
  const getOperatorForModel = (modelName: string): string => {
    // Find the model in available base models
    const matchingModel = availableBaseModels.find(
      model => model.model_name === modelName
    );
    
    // Return the operator if found, or default to "openai"
    return matchingModel?.operator || "openai";
  };

  // Function to handle image uploads
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to handle clearing the image
  const handleClearImage = () => {
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Function to handle keyboard events for the textarea
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter to submit the form
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  };

  // Function to handle paste events (for images)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setImage(event.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !image) return;
    
    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);
    
    // Add an empty assistant message that will be updated with streaming content
    const assistantMessageIndex = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    
    try {
      // Configure the API request - only include fields expected by backend
      const config = {
        operator: getOperatorForModel(baseModel),
        base_model: baseModel,
        collection_name: knowledgeBase,
        web_search: useWebSearch,
        short_term_memory: shortTermMemory, // Now already includes selected memories
        long_term_memory: longTermMemory,
      };

      // Prepare the request
      const request = {
        user_name: username,
        message: input,
        image: image || undefined,
        config: config
      };
      
      // Keep track of the full response for memory
      let fullResponse = '';
      
      // Stream the message to get chunks
      await sendMessage(
        request,
        // Handle each chunk
        (chunk: string) => {
          // Update the assistant message with the accumulated content
          fullResponse += chunk;
          setMessages(currentMessages => {
            const updatedMessages = [...currentMessages];
            if (updatedMessages[assistantMessageIndex]) {
              updatedMessages[assistantMessageIndex] = {
                role: 'assistant',
                content: fullResponse // Use the full response so far
              };
            }
            return updatedMessages;
          });
        },
        // Handle completion
        () => {
          // Add the full response to short-term memory
          setShortTermMemory(prevMemory => [...prevMemory, fullResponse]);
          setIsLoading(false); // Ensure loading state is cleared
        }
      );
      
    } catch (err) {
      // Error is already being handled in the next blocks
      if (err instanceof Error) {
        setError(`Error: ${err.message}`);
      } else {
        setError('An unknown error occurred.');
      }
      
      // Update the assistant message to show an error
      setMessages(currentMessages => {
        const updatedMessages = [...currentMessages];
        if (updatedMessages[assistantMessageIndex]) {
          updatedMessages[assistantMessageIndex] = {
            role: 'assistant',
            content: 'Sorry, I encountered an error.'
          };
        }
        return updatedMessages;
      });
      
      // Ensure loading state is cleared
      setIsLoading(false);
    } finally {
      setInput('');
      setImage(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Focus back on textarea after submitting
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // Knowledge Base Selection (updated part)
  const renderKnowledgeBaseSelection = () => {
    return (
      <div className="form-group">
        <label className="form-label">Knowledge Base</label>
        <select 
          className="form-select"
          value={knowledgeBase}
          onChange={(e) => setKnowledgeBase(e.target.value)}
          disabled={ragLoading}
        >
          {availableKnowledgeBases.map(kb => (
            <option key={kb} value={kb}>{kb}</option>
          ))}
        </select>
        {ragLoading && <div className="loading-indicator">Loading knowledge bases...</div>}
      </div>
    );
  };

  // Base Model Selection
  const renderBaseModelSelection = () => {
    return (
      <div className="form-group">
        <label className="form-label">Base Model</label>
        <select 
          className="form-select" 
          value={baseModel}
          onChange={(e) => setbaseModel(e.target.value)}
          disabled={baseModelsLoading}
        >
          {availableBaseModels.map(model => (
            <option key={model.id || model.model_name} value={model.model_name}>
              {model.model_name}
            </option>
          ))}
        </select>
        {baseModelsLoading && <div className="loading-indicator">Loading base models...</div>}
      </div>
    );
  };
  
  return (
    <div className="chat-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">Peng's Agent</h1>
          <nav className="navigation">
            <ul className="nav-links">
              <li><a href="/memory">Memory</a></li>
              <li><a href="/model">Model</a></li>
              <li><a href="/rag">RAG</a></li>
              <li><a href="https://smith.langchain.com/o/a2c79940-6495-4c24-ab6b-10d0bb8534ee/projects/p/01304a5e-b6f3-4662-8b3e-0befd8886a5a?timeModel=%7B%22duration%22%3A%227d%22%7D" className="external-link">LangSmith</a></li>
              <li><a href="https://github.com/Noahdingpeng/peng-agent" className="external-link">GitHub</a></li>
              <li><a href="https://git.tenawalcott.com/peng-bot/peng-agent" className="external-link">GitLab</a></li>
            </ul>
          </nav>
        </div>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </header>
      
      <div className="main-content">
        {/* Sidebar for Controls */}
        <div className="sidebar">
          <h2 className="sidebar-title">Configuration</h2>
          
          {/* Model Selection - replaced with dynamic version */}
          {renderBaseModelSelection()}
          
          {/* Knowledge Base Selection - replaced with dynamic version */}
          {renderKnowledgeBaseSelection()}
          
          {/* Context Window Slider */}
          <div className="form-group">
            <label className="form-label">
              Context Window: {contextWindow} tokens
            </label>
            <input 
              type="range" 
              min="1024" 
              max="32768" 
              step="1024"
              className="form-range" 
              value={contextWindow}
              onChange={(e) => setContextWindow(parseInt(e.target.value, 10))}
            />
          </div>
          
          {/* Web Search Checkbox */}
          <div className="form-group">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                className="form-checkbox" 
                checked={useWebSearch}
                onChange={(e) => setUseWebSearch(e.target.checked)}
              />
              <span className="checkbox-text">Enable Web Search</span>
            </label>
          </div>
          
          {/* Memory Selection Link */}
          <div className="form-group">
            <a 
              href="/memory" 
              className="memory-link"
            >
              Memory Selection
            </a>
            {shortTermMemory.length > 0 && (
              <div className="selected-memories-count">
                {shortTermMemory.length} short-term memories used
              </div>
            )}
          </div>
        </div>
        
        {/* Main Chat Area */}
        <div className="chat-area">
          {/* Messages Display */}
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <p>Start a conversation with the AI</p>
              </div>
            ) : (
              <div className="messages-list">
                {messages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
                  >
                    {msg.role === 'user' && msg.image && (
                      <div className="message-image-container">
                        <img 
                          src={msg.image} 
                          alt="User uploaded" 
                          className="message-image"
                        />
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      <div className="message-text">
                        <div className="markdown-content">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({node, ...props}) => <p className="tight-paragraph" {...props} />,
                              li: ({node, ...props}) => <li className="tight-list-item" {...props} />,
                              code({node, inline, className, children, ...props}: {
                                node?: any;
                                inline?: boolean;
                                className?: string;
                                children?: React.ReactNode;
                                [key: string]: any;
                              }) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {msg.content || (isLoading && index === messages.length - 1 ? "AI is thinking..." : "")}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <p className="message-text">{msg.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div className="input-container">
            <form onSubmit={handleSubmit} className="input-form">
              {/* Display uploaded image preview if there is one */}
              {image && (
                <div className="image-preview-container">
                  <img 
                    src={image} 
                    alt="Upload preview" 
                    className="image-preview"
                  />
                  <button 
                    type="button"
                    className="clear-image-button"
                    onClick={handleClearImage}
                  >
                    &times;
                  </button>
                </div>
              )}
              <div className="input-row">
                <textarea
                  ref={textareaRef}
                  className="input-textarea"
                  placeholder="Type your message here... (Ctrl+Enter to send)"
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                />
                
                <div className="input-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="file-input"
                    onChange={handleImageUpload}
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="upload-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </label>
                  <button
                    type="submit"
                    className="send-button"
                    disabled={isLoading || (!input.trim() && !image)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotUI;
