import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchBaseModels } from '../store/slices/modelSlice';
import { fetchTools, updateTools } from '../store/slices/toolSlice';
import {
  setInput,
  setSidebarHidden,
  setUploadedImages,
  addUserMessage,
  setBaseModel,
  setKnowledgeBase,
  setSelectedToolNames,
  setShortTermMemory,
  setMessages,
  sendMessage,
  setError,
} from '../store/slices/chatSlice';
import './ChatInterface.css';
import { Message, UploadedImage } from './ChatInterface.types';
import { InputArea } from './InputArea';
import { MessageList } from './MessageList';
import { Memory } from '../hooks/MemoryAPI';
import { useRAGApi } from '../hooks/RAGAPI';

// Main App Component
const ChatbotUI = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Redux State
  const {
    messages,
    input,
    isLoading,
    error,
    isSidebarHidden,
    uploadedImages,
    baseModel,
    knowledgeBase,
    selectedToolNames,
    shortTermMemory,
    longTermMemory,
  } = useSelector((state: RootState) => state.chat);

  const { availableBaseModels, loading: baseModelsLoading } = useSelector((state: RootState) => state.models);
  const { availableTools, loading: toolsLoading, error: toolsError } = useSelector((state: RootState) => state.tools);
  const { user } = useSelector((state: RootState) => state.auth);
  const { getCollections, isLoading: collectionsLoading, error: collectionsError } = useRAGApi();

  // Local UI State
  const [isToolPopupOpen, setIsToolPopupOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [collections, setCollections] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Initial Data Fetching
  useEffect(() => {
    dispatch(fetchBaseModels());
  }, [dispatch]);

  useEffect(() => {
    let isMounted = true;

    const loadCollections = async () => {
      try {
        const data = await getCollections();
        if (!isMounted) return;
        const normalized = Array.isArray(data) ? data : [];
        setCollections(normalized);
        if (normalized.length > 0 && !normalized.includes(knowledgeBase)) {
          dispatch(setKnowledgeBase(normalized[0]));
        }
      } catch {
        if (!isMounted) return;
        setCollections([]);
      }
    };

    loadCollections();

    return () => {
      isMounted = false;
    };
  }, [dispatch, getCollections, knowledgeBase]);

  const displayError = error || toolsError || collectionsError;

  // Username
  const username = user || 'default_user';

  // Load memories from localStorage
  useEffect(() => {
    const savedMemories = localStorage.getItem('selectedMemories');
    const savedMemoryIds = localStorage.getItem('selectedMemoryIds');
    if (savedMemories) {
      try {
        const parsedMemories: Memory[] = JSON.parse(savedMemories);
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

        dispatch(setMessages(memoryMessages));

        if (savedMemoryIds) {
          const parsedIds: number[] = JSON.parse(savedMemoryIds);
          dispatch(setShortTermMemory(parsedIds.filter((id) => Number.isInteger(id))));
        } else {
          const derivedIds = parsedMemories.map((memory) => Number(memory.id)).filter((id) => Number.isInteger(id));
          dispatch(setShortTermMemory(derivedIds));
        }

        localStorage.removeItem('selectedMemories');
        localStorage.removeItem('selectedMemoryIds');
      } catch {
        // Silently ignore memory parsing errors
      }
    }
  }, [dispatch]);

  // Helper
  const getOperatorForModel = (modelName: string): string => {
    if (modelName.includes('/')) {
      return modelName.split('/')[0];
    }
    return 'openai';
  };

  // Tools
  const loadTools = async () => {
    dispatch(fetchTools());
  };

  const handleUpdateTools = async () => {
    await dispatch(updateTools());
  };

  const handleToolSelection = (toolName: string, isSelected: boolean) => {
    if (isSelected) {
      dispatch(setSelectedToolNames([...selectedToolNames, toolName]));
    } else {
      dispatch(setSelectedToolNames(selectedToolNames.filter((name) => name !== toolName)));
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

  // Menu click outside
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

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedImages.length === 0) return;

    const imagePaths = uploadedImages.map((img) => img.path);

    const userMessage: Message = {
      role: 'user',
      content: input,
      type: 'user',
      images: uploadedImages.map((img) => img.preview),
    };

    dispatch(addUserMessage(userMessage));

    const config = {
      operator: getOperatorForModel(baseModel),
      base_model: baseModel,
      tools_name: selectedToolNames,
      short_term_memory: shortTermMemory,
      long_term_memory: longTermMemory,
    };

    const request = {
      user_name: username,
      message: input,
      knowledge_base: knowledgeBase,
      image: imagePaths.length > 0 ? imagePaths : undefined,
      config: config,
    };

    // Use View Transition
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        dispatch(sendMessage(request));
      });
    } else {
      dispatch(sendMessage(request));
    }
  };

  const handleSetInput = (val: string) => dispatch(setInput(val));
  const handleSetUploadedImages = (val: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => {
    if (typeof val === 'function') {
      const newValue = val(uploadedImages);
      dispatch(setUploadedImages(newValue));
    } else {
      dispatch(setUploadedImages(val));
    }
  };

  // Base Model Selection
  const renderBaseModelSelection = () => {
    return (
      <div className="form-group">
        <label className="form-label">Base Model</label>
        <select
          className="form-select"
          value={baseModel}
          onChange={(e) => dispatch(setBaseModel(e.target.value))}
          disabled={baseModelsLoading}
        >
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

  const renderKnowledgeBaseSelection = () => {
    const isDisabled = collectionsLoading || collections.length === 0;
    return (
      <div className="form-group">
        <label className="form-label">Knowledge Base</label>
        <select
          className="form-select"
          value={knowledgeBase}
          onChange={(e) => dispatch(setKnowledgeBase(e.target.value))}
          disabled={isDisabled}
        >
          {collections.length === 0 ? (
            <option value="">No collections available</option>
          ) : (
            collections.map((collection) => (
              <option key={collection} value={collection}>
                {collection}
              </option>
            ))
          )}
        </select>
        {collectionsLoading && <div className="loading-indicator">Loading knowledge bases...</div>}
      </div>
    );
  };

  return (
    <div className={`chat-container ${isSidebarHidden ? 'sidebar-hidden' : ''}`}>
      {/* Top-right menu */}
      <div className="top-right-menu" ref={menuRef}>
        <button
          type="button"
          className="menu-button"
          aria-label="Open menu"
          title="Menu"
          onClick={() => setIsMenuOpen((v) => !v)}
        >
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

      {displayError && <div className="error-message">{displayError}</div>}

      <div className="main-content">
        {/* Show sidebar handle */}
        {isSidebarHidden && (
          <button
            type="button"
            className="show-sidebar-toggle"
            onClick={() => dispatch(setSidebarHidden(false))}
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

        {/* Sidebar */}
        {!isSidebarHidden && (
          <div className="sidebar">
            <div className="sidebar-header-row">
              <h2 className="sidebar-title">Configuration</h2>
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => dispatch(setSidebarHidden(true))}
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

            {renderBaseModelSelection()}
            {renderKnowledgeBaseSelection()}

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
                      <button
                        type="button"
                        className="tool-remove-button"
                        onClick={() => handleToolSelection(toolName, false)}
                        title="Remove tool"
                      >
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
              {shortTermMemory.length > 0 && (
                <div className="selected-memories-count">{shortTermMemory.length} short-term memories used</div>
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="chat-area">
          <div className="top-left-title">
            <div className="title-chip" title="Peng's Agent">
              Peng's Agent
            </div>
          </div>

          <div className="messages-container">
            <MessageList messages={messages} isLoading={isLoading} />
          </div>

          <InputArea
            input={input}
            setInput={handleSetInput}
            uploadedImages={uploadedImages}
            setUploadedImages={handleSetUploadedImages}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            onError={(msg) => dispatch(setError(msg))}
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
