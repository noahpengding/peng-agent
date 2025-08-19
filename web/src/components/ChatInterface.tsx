import React, { useState, useEffect, useRef } from 'react';
import { useChatApi } from '../hooks/ChatAPI';
import { Memory } from '../hooks/MemoryAPI';
import { Tool, useToolApi } from '../hooks/ToolAPI';
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
    // type distinguishes different message types: tool_calls, reasoning_summary, output_text
    type?: 'tool_calls' | 'reasoning_summary' | 'output_text' | 'user' | 'assistant';
    // folded indicates messages should be initially collapsed
    folded?: boolean;
    // messageId to track related messages
    messageId?: string;
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
          // Set default to first available model's model_name
          setbaseModel(data[0].model_name);
        }
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
  const [shortTermMemory, setShortTermMemory] = useState<string[]>([]);
  const [longTermMemory] = useState([]);

  // Load any selected memories from localStorage on component mount
  useEffect(() => {
    const savedMemories = localStorage.getItem('selectedMemories');
    if (savedMemories) {
      try {
        const parsedMemories: Memory[] = JSON.parse(savedMemories);
        // Prepare both the short-term memory strings for API config
        const formattedMemories: string[] = [];
        // Prepare initial messages to display in chat
        const memoryMessages: Message[] = [];
        parsedMemories.forEach((memory) => {
          formattedMemories.push('human: ' + memory.human_input);
          formattedMemories.push('assistant: ' + memory.ai_response);
          // Add as chat messages
          memoryMessages.push({ role: 'user', content: memory.human_input });
          memoryMessages.push({ role: 'assistant', content: memory.ai_response });
        });
        setShortTermMemory(formattedMemories);
        // Preload messages to display selected memories
        setMessages(memoryMessages);
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
    const newMessages = [...messages, { role: 'user', content: input, type: 'user' as const }];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);

    // Generate a unique message ID for this conversation turn
    const messageId = Date.now().toString();

    try {
      // Configure the API request - only include fields expected by backend
      const config = {
        operator: getOperatorForModel(baseModel),
        base_model: baseModel,
        tools_name: selectedToolNames, // Use selected tool names
        short_term_memory: shortTermMemory, // Now already includes selected memories
        long_term_memory: longTermMemory,
      };

      // Prepare the request
      const request = {
        user_name: username,
        message: input,
        image: image || undefined,
        config: config,
      };

      // Keep track of accumulated content for each type in a more straightforward way
      let outputContent = '';
      let lastReasoningContent = '';
      let allToolCallsContent: string[] = [];

      // Stream the message to get chunks (type-aware)
      await sendMessage(
        request,
        // Handle each chunk with its type
        (chunk: string, type: string) => {
          // Skip empty chunks
          if (!chunk.trim()) return;

          if (type === 'tool_calls') {
            // Add individual tool message chunk as a separate message
            const toolMessage: Message = {
              role: 'assistant',
              content: chunk,
              type: 'tool_calls',
              folded: false,
              messageId,
            };
            setMessages((current) => [...current, toolMessage]);
            // Track tool calls content for memory
            allToolCallsContent.push(chunk);
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
                return updated;
              } else {
                // Start a new reasoning message
                lastReasoningContent = chunk;
                const reasoningMessage: Message = {
                  role: 'assistant',
                  content: chunk,
                  type: 'reasoning_summary',
                  folded: false,
                  messageId,
                };
                return [...updated, reasoningMessage];
              }
            });
          } else if (type === 'output_text') {
            // Accumulate output content
            outputContent += chunk;

            setMessages((currentMessages) => {
              const updated = [...currentMessages];
              // Check if there's already an output message for this messageId
              const existingOutputIndex = updated.findIndex((msg) => msg.messageId === messageId && msg.type === 'output_text');

              if (existingOutputIndex >= 0) {
                // Update existing output message
                updated[existingOutputIndex] = {
                  ...updated[existingOutputIndex],
                  content: outputContent,
                };
                return updated;
              } else {
                // Create new output message
                const outputMessage: Message = {
                  role: 'assistant',
                  content: outputContent,
                  type: 'output_text',
                  folded: false,
                  messageId,
                };
                return [...updated, outputMessage];
              }
            });
          }
        },
        // Handle completion
        () => {
          // Fold tool_calls and reasoning_summary messages, keep output_text unfolded
          setMessages((current) =>
            current.map((m) => {
              if (m.messageId === messageId) {
                if (m.type === 'tool_calls' || m.type === 'reasoning_summary') {
                  return { ...m, folded: true };
                }
              }
              return m;
            })
          );

          // Add each type of content as separate entries to short-term memory
          setShortTermMemory((prev) => {
            const newMemories = [...prev];

            // Add the human input first
            newMemories.push('human: ' + input);

            // Add tool calls if any
            if (allToolCallsContent.length > 0) {
              const toolCallsText = allToolCallsContent.join('\n');
              newMemories.push('assistant: Tool Calls: ' + toolCallsText);
            }

            // Add reasoning if any
            if (lastReasoningContent.trim()) {
              newMemories.push('assistant: Reasoning: ' + lastReasoningContent.trim());
            }

            // Add output text if any
            if (outputContent.trim()) {
              newMemories.push('assistant: Response: ' + outputContent.trim());
            }

            return newMemories;
          });

          setIsLoading(false);
        }
      );
    } catch (err) {
      // Error is already being handled in the next blocks
      if (err instanceof Error) {
        setError(`Error: ${err.message}`);
      } else {
        setError('An unknown error occurred.');
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
    <div className="chat-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">Peng's Agent</h1>
          <nav className="navigation">
            <ul className="nav-links">
              <li>
                <a href="/memory">Memory</a>
              </li>
              <li>
                <a href="/model">Model</a>
              </li>
              <li>
                <a href="/rag">RAG</a>
              </li>
              <li>
                <a
                  href="https://llm.tenawalcott.com/projects/UHJvamVjdDoz/spans"
                  className="external-link"
                >
                  Phoenix Observability
                </a>
              </li>
              <li>
                <a href="https://github.com/Noahdingpeng/peng-agent" className="external-link">
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        </div>
        {error && <div className="error-message">{error}</div>}
      </header>

      <div className="main-content">
        {/* Sidebar for Controls */}
        <div className="sidebar">
          <h2 className="sidebar-title">Configuration</h2>

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
                  <div key={index} className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}>
                    {msg.role === 'user' && msg.image && (
                      <div className="message-image-container">
                        <img src={msg.image} alt="User uploaded" className="message-image" />
                      </div>
                    )}
                    {msg.type === 'tool_calls' ? (
                      <details className="tool-details" open={!msg.folded}>
                        <summary className="tool-summary">Tool Calls</summary>
                        <div className="message-text tool-text">{msg.content}</div>
                      </details>
                    ) : msg.type === 'reasoning_summary' ? (
                      <details className="tool-details" open={!msg.folded}>
                        <summary className="tool-summary">Reasoning</summary>
                        <div className="message-text tool-text">{msg.content}</div>
                      </details>
                    ) : msg.role === 'assistant' ? (
                      <div className="message-text">
                        <div className="markdown-content">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({ ...props }) => <p className="tight-paragraph" {...props} />,
                              li: ({ ...props }) => <li className="tight-list-item" {...props} />,
                              code: (props: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
                                const { inline, className, children, ...rest } = props;
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={vscDarkPlus as Record<string, React.CSSProperties>}
                                    language={match[1]}
                                    PreTag="div"
                                    {...rest}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={className} {...rest}>
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {msg.content || (isLoading && index === messages.length - 1 ? 'AI is thinking...' : '')}
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
                  <img src={image} alt="Upload preview" className="image-preview" />
                  <button type="button" className="clear-image-button" onClick={handleClearImage}>
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
                  <input ref={fileInputRef} type="file" accept="image/*" className="file-input" onChange={handleImageUpload} id="image-upload" />
                  <label htmlFor="image-upload" className="upload-button">
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
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </label>
                  <button type="submit" className="send-button" disabled={isLoading || (!input.trim() && !image)}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </form>
          </div>
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
