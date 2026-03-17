import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@share/store';
import { fetchBaseModels } from '@share/store/slices/modelSlice';
import { fetchTools, updateTools } from '@share/store/slices/toolSlice';
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
  submitMessageFeedback,
} from '@share/store/slices/chatSlice';
import './ChatInterface.css';
import { Message, UploadedImage } from '@share/types/ChatInterface.types';
import { InputArea } from './InputArea';
import { MessageList } from './MessageList';
import { Memory } from '@share/hooks/MemoryAPI';
import { useRAGApi } from '@share/hooks/RAGAPI';

// Code split heavy components
const UserProfilePopup = lazy(() => import('./UserProfilePopup'));

// Main App Component
const ChatbotUI = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Redux State
  const { messages, input, isLoading, error, isSidebarHidden, uploadedImages, baseModel, knowledgeBase, selectedToolNames, shortTermMemory } =
    useSelector((state: RootState) => state.chat);

  const { availableBaseModels, loading: baseModelsLoading } = useSelector((state: RootState) => state.models);
  const { availableTools, loading: toolsLoading, error: toolsError } = useSelector((state: RootState) => state.tools);
  const { user } = useSelector((state: RootState) => state.auth);
  const { getCollections, isLoading: collectionsLoading, error: collectionsError } = useRAGApi();

  // Stable ref for getCollections — captured once so the mount effect has no changing deps
  const getCollectionsRef = useRef(getCollections);

  // Local UI State
  const [isToolPopupOpen, setIsToolPopupOpen] = useState(false);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [collections, setCollections] = useState<string[]>([]);
  const [s3PathsInput, setS3PathsInput] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Initial Data Fetching
  useEffect(() => {
    dispatch(fetchBaseModels());
  }, [dispatch]);

  // Run once on mount — fetch collections
  useEffect(() => {
    let isMounted = true;
    const initialKnowledgeBase = knowledgeBase;

    getCollectionsRef
      .current()
      .then((data) => {
        if (!isMounted) return;
        const normalized = ["default"].concat(Array.isArray(data) ? data : []);
        setCollections(normalized);
        if (normalized.length > 0 && !normalized.includes(initialKnowledgeBase)) {
          dispatch(setKnowledgeBase(normalized[0]));
        }
      })
      .catch(() => {
        if (isMounted) setCollections([]);
      });

    return () => {
      isMounted = false;
    };
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!input.trim() && uploadedImages.length === 0 && s3PathsInput.trim().length === 0) return;

    const s3Entries = s3PathsInput
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const formatPattern = /^[a-zA-Z0-9._-]+:\/\/.+$/;
    const invalidEntries = s3Entries.filter((value) => !formatPattern.test(value));
    if (invalidEntries.length > 0) {
      dispatch(setError('Invalid path format. Use {bucket_name}://{bucket_path}.'));
      return;
    }

    const imagePaths = [...uploadedImages.map((img) => img.path), ...s3Entries];

    const userMessage: Message = {
      role: 'user',
      content: input,
      type: 'user',
      images: uploadedImages.filter((img) => img.contentType.startsWith('image/')).map((img) => img.preview),
    };

    dispatch(addUserMessage(userMessage));

    const config = {
      operator: getOperatorForModel(baseModel),
      base_model: baseModel,
      tools_name: selectedToolNames,
      short_term_memory: shortTermMemory,
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

    if (s3PathsInput.trim().length > 0) {
      setS3PathsInput('');
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

  // ⚡ Bolt Optimization: Memoize the feedback handler to keep its reference stable across renders.
  // This prevents the expensive MessageList component from re-rendering on every keystroke in the input area.
  const handleSubmitFeedback = useCallback(
    (messageId: string, chatId: number, feedback: 'upvote' | 'downvote' | 'no_response') => {
      dispatch(
        submitMessageFeedback({
          messageId,
          chatId,
          userName: username,
          feedback,
        })
      );
    },
    [dispatch, username]
  );

  // Base Model Selection
  const renderBaseModelSelection = () => {
    return (
      <div className="form-group">
        <label htmlFor="base_model" className="form-label">Base Model</label>
        <select id="base_model" className="form-select" value={baseModel} onChange={(e) => dispatch(setBaseModel(e.target.value))} disabled={baseModelsLoading}>
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
        <label htmlFor="knowledge_base" className="form-label">Knowledge Base</label>
        <select id="knowledge_base" className="form-select" value={knowledgeBase} onChange={(e) => dispatch(setKnowledgeBase(e.target.value))} disabled={isDisabled}>
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
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
          whileTap={{ scale: 0.95 }}
          type="button"
          className="menu-button"
          aria-label="Open menu"
          title="Menu"
          onClick={() => setIsMenuOpen((v) => !v)}
        >
          …
        </motion.button>
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="menu-dropdown"
              role="menu"
              aria-label="Navigation Menu"
            >
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
                href="https://us5.datadoghq.com/llm/applications?query=&fromUser=true&start=1770794053588&end=1770880453588&paused=false"
                className="menu-item external-link"
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMenuOpen(false)}
              >
                Datadog LLM Observability
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {displayError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="error-message"
          >
            {displayError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="main-content">
        {/* Show sidebar handle */}
        <AnimatePresence>
          {isSidebarHidden && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
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
            </motion.button>
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {!isSidebarHidden && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '16rem', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="sidebar"
              style={{ overflow: 'hidden' }}
            >
              <div className="sidebar-header-row">
                <h2 className="sidebar-title">Configuration</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
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
                </motion.button>
              </div>

              {renderBaseModelSelection()}
              {renderKnowledgeBaseSelection()}

              {/* Tool Selection */}
              <div className="form-group">
                <div className="tool-section-header">
                  <label className="form-label">Tools</label>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="tool-add-button"
                    onClick={openToolPopup}
                    title="Add Tools"
                    aria-label="Add Tools"
                  >
                    +
                  </motion.button>
                </div>
                {selectedToolNames.length > 0 ? (
                  <div className="selected-tools-list">
                    <AnimatePresence mode="popLayout">
                      {selectedToolNames.map((toolName) => (
                        <motion.div
                          key={toolName}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="selected-tool-item"
                        >
                          <span className="selected-tool-name">{toolName}</span>
                          <button type="button" className="tool-remove-button" onClick={() => handleToolSelection(toolName, false)} title="Remove tool" aria-label={`Remove tool ${toolName}`}>
                            ×
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
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

              {/* User Profile Button */}
              <div className="form-group user-profile-button-container">
                <motion.button
                  whileHover={{ backgroundColor: '#4b5563' }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  className="memory-link user-profile-button"
                  onClick={() => setIsProfilePopupOpen(true)}
                >
                  User Profile
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <div className="chat-area">
          <div className="top-left-title">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="title-chip"
              title="Peng's Agent"
            >
              Peng's Agent
            </motion.div>
          </div>

          <div className="messages-container">
            <MessageList messages={messages} isLoading={isLoading} onSubmitFeedback={handleSubmitFeedback} />
          </div>

          <InputArea
            input={input}
            setInput={handleSetInput}
            s3PathsInput={s3PathsInput}
            setS3PathsInput={setS3PathsInput}
            uploadedImages={uploadedImages}
            setUploadedImages={handleSetUploadedImages}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            onError={(msg) => dispatch(setError(msg))}
          />
        </div>
      </div>

      {/* Tool Selection Popup */}
      <AnimatePresence>
        {isToolPopupOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="popup-overlay"
            onClick={closeToolPopup}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="popup-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="popup-header">
                <h3>Select Tools</h3>
                <div className="popup-actions">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="update-button"
                    onClick={handleUpdateTools}
                    disabled={toolsLoading}
                  >
                    {toolsLoading ? 'Updating...' : 'Update'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                    whileTap={{ scale: 0.9 }}
                    className="close-button"
                    onClick={closeToolPopup}
                    aria-label="Close tool popup"
                  >
                    ×
                  </motion.button>
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
                      <motion.div
                        layout
                        key={tool.id}
                        className="tool-item"
                      >
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
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <UserProfilePopup isOpen={isProfilePopupOpen} onClose={() => setIsProfilePopupOpen(false)} availableModels={availableBaseModels} />
      </Suspense>
    </div>
  );
};

export default ChatbotUI;
