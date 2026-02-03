import React, { useState, useEffect, useRef } from 'react';
import { useChatApi } from '../hooks/ChatAPI';
import { Memory } from '../hooks/MemoryAPI';
import { Tool, useToolApi } from '../hooks/ToolAPI';
import { useAuth } from '../contexts/AuthContext';
import './ChatInterface.css';
import { apiCall } from '../utils/apiUtils';
import { Message, ModelInfo, UploadedImage } from './ChatInterface.types';
import { InputArea } from './InputArea';
import { MessageList } from './MessageList';

// Main App Component
const ChatbotUI = () => {
  // State for chat input and messages
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  // State to control sidebar visibility
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize the chat API hook
  const { sendMessage, error: apiError } = useChatApi();
  // Initialize the tool API hook
  const { getAllTools, updateTools, isLoading: toolsLoading, error: toolsError } = useToolApi();
  // Get authentication context
  const { user } = useAuth();

  // State for available base models
  const [availableBaseModels, setAvailableBaseModels] = useState<ModelInfo[]>([]);
  // Loading states for model lists
  const [baseModelsLoading, setBaseModelsLoading] = useState(false);

  // Tool selection states
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [selectedToolNames, setSelectedToolNames] = useState<string[]>([]);
  const [isToolPopupOpen, setIsToolPopupOpen] = useState(false);

  // Map UI selections to backend config
  useEffect(() => {
    if (apiError) {
      setError(`API Error: ${apiError}`);
    }
  }, [apiError]);

  // Handle tool API errors
  useEffect(() => {
    if (toolsError) {
      setError(`Tool API Error: ${toolsError}`);
    }
  }, [toolsError]);

  // Fetch available base models on component mount
  useEffect(() => {
    const fetchAvailableModels = async () => {
      // Fetch base models
      setBaseModelsLoading(true);
      try {
        const data = await apiCall('POST', '/avaliable_model', { type: 'base' });

        if (Array.isArray(data) && data.length > 0) {
          setAvailableBaseModels(data);
        }

        setbaseModel(data[0]?.model_name || 'gpt-4');
      } catch (error) {
        setError(`Failed to fetch base models: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to default models as simple strings to maintain compatibility
        setAvailableBaseModels([
          { id: '1', operator: 'openai', type: 'base', model_name: 'gpt-4', isAvailable: true },
          { id: '2', operator: 'openai', type: 'base', model_name: 'gpt-3.5-turbo', isAvailable: true },
          { id: '3', operator: 'anthropic', type: 'base', model_name: 'claude-3-opus', isAvailable: true },
          { id: '4', operator: 'anthropic', type: 'base', model_name: 'claude-3-sonnet', isAvailable: true },
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
  const [shortTermMemory, setShortTermMemory] = useState<number[]>([]);
  const [longTermMemory] = useState([]);

  // Track latest chat id returned by backend
  const latestChatIdRef = useRef<number | null>(null);

  const extractChatIdFromChunk = (chunk: string): number | null => {
    const trimmed = chunk.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/-?\d+/);
    if (!match) return null;
    const id = Number(match[0]);
    return Number.isInteger(id) ? id : null;
  };

  // Load any selected memories from localStorage on component mount
  useEffect(() => {
    const savedMemories = localStorage.getItem('selectedMemories');
    const savedMemoryIds = localStorage.getItem('selectedMemoryIds');
    if (savedMemories) {
      try {
        const parsedMemories: Memory[] = JSON.parse(savedMemories);
        // Prepare initial messages to display in chat
        const memoryMessages: Message[] = [];
        parsedMemories.forEach((memory) => {
          memoryMessages.push({
            role: 'user',
            content: memory.human_input,
            type: 'user',
          });
          memoryMessages.push({
            role: 'assistant',
            content: memory.ai_response,
            type: 'assistant',
          });
        });
        if (savedMemoryIds) {
          const parsedIds: number[] = JSON.parse(savedMemoryIds);
          setShortTermMemory(parsedIds.filter((id) => Number.isInteger(id)));
        } else {
          const derivedIds = parsedMemories.map((memory) => Number(memory.id)).filter((id) => Number.isInteger(id));
          setShortTermMemory(derivedIds);
        }
        // Preload messages to display selected memories
        setMessages(memoryMessages);
        // Clear saved memories from localStorage after loading
        localStorage.removeItem('selectedMemories');
        localStorage.removeItem('selectedMemoryIds');
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to parse saved memories');
      }
    }
  }, []);

  // Function to determine operator based on model name
  const getOperatorForModel = (modelName: string): string => {
    // Find the model in available base models
    const matchingModel = availableBaseModels.find((model) => model.model_name === modelName);

    // Return the operator if found, or default to "openai"
    return matchingModel?.operator || 'openai';
  };

  // Tool management functions
  const loadTools = async () => {
    try {
      const tools = await getAllTools();
      setAvailableTools(tools);
    } catch (error) {
      setError(`Failed to load tools: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleUpdateTools = async () => {
    try {
      await updateTools();
      await loadTools(); // Refresh the tools list
    } catch (error) {
      setError(`Failed to update tools: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleToolSelection = (toolName: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedToolNames((prev) => [...prev, toolName]);
    } else {
      setSelectedToolNames((prev) => prev.filter((name) => name !== toolName));
    }
  };

  const openToolPopup = () => {
    setIsToolPopupOpen(true);
    if (availableTools.length === 0) {
      loadTools();
    }
  };

  const closeToolPopup = () => {
    setIsToolPopupOpen(false);
  };

  // Top-right menu state and refs
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedImages.length === 0) return;

    // Collect image paths from uploaded images
    const imagePaths = uploadedImages.map((img) => img.path);

    // Add user message to chat (with preview images for display)
    const userMessage: Message = {
      role: 'user',
      content: input,
      type: 'user',
      images: uploadedImages.map((img) => img.preview), // Use preview for display
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);

    // Generate a unique message ID for this conversation turn
    const messageId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    try {
      // Configure the API request - only include fields expected by backend
      const config = {
        operator: getOperatorForModel(baseModel),
        base_model: baseModel,
        tools_name: selectedToolNames,
        short_term_memory: shortTermMemory,
        long_term_memory: longTermMemory,
      };

      // Prepare the request with image paths (not base64)
      const request = {
        user_name: username,
        message: input,
        image: imagePaths.length > 0 ? imagePaths : undefined,
        config: config,
      };

      // Keep track of accumulated content for each type in a more straightforward way
      let outputContent = '';
      let lastReasoningContent = '';

      // Stream the message to get chunks (type-aware)
      await sendMessage(
        request,
        // Handle each chunk with its type
        (chunk: string, type: string, done: boolean) => {
          if (done) {
            const chatId = extractChatIdFromChunk(chunk);
            if (chatId !== null) {
              latestChatIdRef.current = chatId;
              return;
            }
          }
          if (done && !chunk) {
            return;
          }

          if (type === 'tool_calls' || type === 'tool_output') {
            // Add individual tool message chunk as a separate message
            const toolMessage: Message = {
              role: 'assistant',
              content: chunk,
              type: type,
              folded: false,
              messageId,
            };
            setMessages((current) => [...current, toolMessage]);
            // Reset reasoning tracking for new sequence
            lastReasoningContent = '';
          } else if (type === 'reasoning_summary') {
            setMessages((currentMessages) => {
              const updated = [...currentMessages];
              // Check if this is continuation of the same reasoning sequence
              const lastMessage = updated[updated.length - 1];
              const isContinuation = lastMessage && lastMessage.type === 'reasoning_summary' && lastMessage.messageId === messageId;

              if (isContinuation) {
                // Update the last reasoning message
                lastReasoningContent += chunk;
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: lastReasoningContent,
                };
              } else {
                // Start new reasoning message
                lastReasoningContent = chunk;
                updated.push({
                  role: 'assistant',
                  content: chunk,
                  type: 'reasoning_summary',
                  folded: false,
                  messageId,
                });
              }
              return updated;
            });
          } else if (type === 'output_text') {
            // Accumulate output_text chunks
            outputContent += chunk;
            setMessages((currentMessages) => {
              const updated = [...currentMessages];
              const lastMessage = updated[updated.length - 1];
              const isOutputContinuation = lastMessage && lastMessage.type === 'output_text' && lastMessage.messageId === messageId;

              if (isOutputContinuation) {
                // Update the last output message
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: outputContent,
                };
              } else {
                // Start a new output message
                updated.push({
                  role: 'assistant',
                  content: outputContent,
                  type: 'output_text',
                  messageId,
                });
              }
              return updated;
            });
          }
        },
        // On complete
        () => {
          // Fold tool_calls and reasoning_summary messages, keep output_text unfolded
          setMessages((current) =>
            current.map((m) => {
              if (m.messageId === messageId) {
                if (m.type === 'tool_calls' || m.type === 'tool_output' || m.type === 'reasoning_summary') {
                  return { ...m, folded: true };
                } else if (m.type === 'output_text') {
                  // Clean up double newlines in output text
                  return { ...m, content: m.content.replace(/\n\n+/g, '\n') };
                }
              }
              return m;
            })
          );

          const chatIdToStore = latestChatIdRef.current;
          // Add latest chat id to short-term memory
          setShortTermMemory((prev) => {
            const newMemories = [...prev];
            if (chatIdToStore !== null) {
              newMemories.push(chatIdToStore);
            }
            return newMemories;
          });
          latestChatIdRef.current = null;

          setIsLoading(false);
        }
      );
    } catch (err) {
      // Error is already being handled in the next blocks
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }

      // Add error message
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error.',
          type: 'output_text',
          messageId,
        },
      ]);

      // Ensure loading state is cleared
      setIsLoading(false);
    } finally {
      setInput('');
      setUploadedImages([]);
    }
  };

  // Base Model Selection
  const renderBaseModelSelection = () => {
    return (
      <div className="form-group">
        <label className="form-label">Base Model</label>
        <select className="form-select" value={baseModel} onChange={(e) => setbaseModel(e.target.value)} disabled={baseModelsLoading}>
          {availableBaseModels.map((model) => (
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
    <div className={`chat-container ${isSidebarHidden ? 'sidebar-hidden' : ''}`}>
      {/* Top-right menu (replaces header navigation) */}
      <div className="top-right-menu" ref={menuRef}>
        <button type="button" className="menu-button" aria-label="Open menu" title="Menu" onClick={() => setIsMenuOpen((v) => !v)}>
          …
        </button>
        {isMenuOpen && (
          <div className="menu-dropdown" role="menu" aria-label="Navigation Menu">
            <a href="/memory" className="menu-item" onClick={() => setIsMenuOpen(false)}>
              Memory
            </a>
            <a href="/model" className="menu-item" onClick={() => setIsMenuOpen(false)}>
              Model
            </a>
            <a href="/rag" className="menu-item" onClick={() => setIsMenuOpen(false)}>
              RAG
            </a>
            <a
              href="https://llm.tenawalcott.com/projects/UHJvamVjdDoz/spans"
              className="menu-item external-link"
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsMenuOpen(false)}
            >
              Phoenix Observability
            </a>
            <a
              href="https://github.com/Noahdingpeng/peng-agent"
              className="menu-item external-link"
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsMenuOpen(false)}
            >
              GitHub
            </a>
          </div>
        )}
      </div>
      {error && <div className="error-message">{error}</div>}

      <div className="main-content">
        {/* Show sidebar handle when hidden */}
        {isSidebarHidden && (
          <button
            type="button"
            className="show-sidebar-toggle"
            onClick={() => setIsSidebarHidden(false)}
            title="Show sidebar"
            aria-label="Show sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
              <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
            </svg>
          </button>
        )}
        {/* Sidebar for Controls */}
        {!isSidebarHidden && (
          <div className="sidebar">
            <div className="sidebar-header-row">
              <h2 className="sidebar-title">Configuration</h2>
              {/* Hide sidebar button */}
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setIsSidebarHidden(true)}
                aria-label="Hide sidebar"
                title="Hide sidebar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                  <path d="M9 4v16" />
                </svg>
              </button>
            </div>

            {/* Model Selection - replaced with dynamic version */}
            {renderBaseModelSelection()}

            {/* Tool Selection */}
            <div className="form-group">
              <div className="tool-section-header">
                <label className="form-label">Tools</label>
                <button className="tool-add-button" onClick={openToolPopup} title="Add Tools">
                  +
                </button>
              </div>
              {selectedToolNames.length > 0 ? (
                <div className="selected-tools-list">
                  {selectedToolNames.map((toolName, index) => (
                    <div key={index} className="selected-tool-item">
                      <span className="selected-tool-name">{toolName}</span>
                      <button type="button" className="tool-remove-button" onClick={() => handleToolSelection(toolName, false)} title="Remove tool">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-tools-selected">No tools selected</div>
              )}
            </div>

            {/* Memory Selection Link */}
            <div className="form-group">
              <a href="/memory" className="memory-link">
                Memory Selection
              </a>
              {shortTermMemory.length > 0 && <div className="selected-memories-count">{shortTermMemory.length} short-term memories used</div>}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="chat-area">
          {/* Top-left title chip (scoped to chat area) */}
          <div className="top-left-title">
            <div className="title-chip" title="Peng's Agent">
              Peng's Agent
            </div>
          </div>
          {/* Messages Display */}
          <div className="messages-container">
            <MessageList messages={messages} isLoading={isLoading} />
          </div>

          {/* Input Area */}
          <InputArea
            input={input}
            setInput={setInput}
            uploadedImages={uploadedImages}
            setUploadedImages={setUploadedImages}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            onError={setError}
          />
        </div>
      </div>

      {/* Tool Selection Popup */}
      {isToolPopupOpen && (
        <div className="popup-overlay" onClick={closeToolPopup}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Select Tools</h3>
              <div className="popup-actions">
                <button className="update-button" onClick={handleUpdateTools} disabled={toolsLoading}>
                  {toolsLoading ? 'Updating...' : 'Update'}
                </button>
                <button className="close-button" onClick={closeToolPopup}>
                  ×
                </button>
              </div>
            </div>
            <div className="popup-body">
              {toolsLoading ? (
                <div className="loading-indicator">Loading tools...</div>
              ) : availableTools.length === 0 ? (
                <div className="no-tools">No tools available</div>
              ) : (
                <div className="tools-list">
                  {availableTools.map((tool) => (
                    <div key={tool.id} className="tool-item">
                      <label className="tool-checkbox-label">
                        <input
                          type="checkbox"
                          className="tool-checkbox"
                          checked={selectedToolNames.includes(tool.name)}
                          onChange={(e) => handleToolSelection(tool.name, e.target.checked)}
                        />
                        <div className="tool-info">
                          <div className="tool-name">{tool.name}</div>
                          <div className="tool-type">{tool.type}</div>
                          <div className="tool-url">{tool.url}</div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotUI;
