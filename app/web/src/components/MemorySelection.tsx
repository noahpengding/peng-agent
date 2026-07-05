import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useMemoryApi, Memory } from '@/hooks/MemoryAPI';
import './MemorySelection.css';

const MemoryPage: React.FC = () => {
  // State variables
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemoriesById, setSelectedMemoriesById] = useState<Record<string, Memory>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const navigate = useNavigate();
  const { fetchMemories, isLoading } = useMemoryApi();
  const { user } = useSelector((state: RootState) => state.auth);

  const selectedMemoryIds = useMemo(() => Object.keys(selectedMemoriesById), [selectedMemoriesById]);

  // Fetch memories on component mount and whenever page/search changes
  useEffect(() => {
    let mounted = true;

    const getMemories = async (username: string) => {
      try {
        setError(null);
        const response = await fetchMemories(username, currentPage, searchTerm);
        if (!mounted) return;
        setMemories(response.memories);
        setCurrentPage(response.page);
        setTotalPages(response.total_pages);
        setTotalCount(response.total_count);
        setHasNextPage(response.has_next);
        setHasPreviousPage(response.has_previous);
      } catch (error) {
        if (mounted) {
          setError(`Failed to fetch memories: ${error}`);
        }
      }
    };

    // Only fetch after user is available
    if (user) {
      getMemories(user);
    }

    return () => {
      mounted = false;
    };
  }, [user, currentPage, searchTerm, fetchMemories]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Handle checkbox change
  const handleCheckboxChange = (memory: Memory) => {
    setSelectedMemoriesById((prevSelectedMemories) => {
      const nextSelectedMemories = { ...prevSelectedMemories };
      if (nextSelectedMemories[memory.id]) {
        delete nextSelectedMemories[memory.id];
      } else {
        nextSelectedMemories[memory.id] = memory;
      }
      return nextSelectedMemories;
    });
  };

  // Handle primary button click - save if memories are selected, otherwise exit
  const handlePrimaryAction = () => {
    if (selectedMemoryIds.length > 0) {
      const selectedMemories = Object.values(selectedMemoriesById);

      // Save selected memories for UI display
      localStorage.setItem('selectedMemories', JSON.stringify(selectedMemories));

      // Save selected memory IDs (chat IDs) for backend
      const selectedChatIds = selectedMemories.map((memory) => Number(memory.id)).filter((id) => Number.isInteger(id));
      localStorage.setItem('selectedMemoryIds', JSON.stringify(selectedChatIds));
    }

    // In all cases, navigate back to chat interface
    navigate('/');
  };

  const handlePreviousPage = () => {
    setCurrentPage((page) => Math.max(page - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  };

  // Truncate text for display
  const truncateText = (text: string, maxLength: number = 400) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="memory-selection-container">
      {/* Search Bar */}
      <div className="search-container">
        <input
          id="search-memories"
          type="text"
          placeholder="Search memories..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Search memories"
        />
      </div>

      {/* Merged Action Button */}
      <div className="action-buttons">
        <button className="primary-button" onClick={handlePrimaryAction}>
          {selectedMemoryIds.length > 0 ? `Save ${selectedMemoryIds.length} Selected Memories` : 'Return to Chat'}
        </button>
      </div>

      <div className="pagination-controls" aria-label="Memory pages">
        <button className="pagination-button" onClick={handlePreviousPage} disabled={!hasPreviousPage || isLoading}>
          Previous
        </button>
        <div className="page-indicator">
          Page {currentPage} of {totalPages}
          {totalCount > 0 && <span className="total-count"> {totalCount} memories</span>}
        </div>
        <button className="pagination-button" onClick={handleNextPage} disabled={!hasNextPage || isLoading}>
          Next
        </button>
      </div>

      {/* Loading and Error States */}
      {isLoading && <div className="loading-indicator">Loading memories...</div>}
      {error && <div className="error-message" role="alert" aria-live="assertive">Error: {error}</div>}

      {/* Memories Table */}
      {!isLoading && !error && (
        <div className="memories-table-container">
          <table className="memories-table">
            <thead>
              <tr>
                <th className="select-column">Select</th>
                <th className="model-column">Model</th>
                <th className="human-input-column">Human Input</th>
                <th className="ai-response-column">AI Response</th>
              </tr>
            </thead>
            <tbody>
              {memories.length > 0 ? (
                memories.map((memory) => (
                  <tr
                    key={memory.id}
                    onClick={() => handleCheckboxChange(memory)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <input
                        id={`memory-checkbox-${memory.id}`}
                        type="checkbox"
                        checked={selectedMemoryIds.includes(memory.id)}
                        onChange={() => handleCheckboxChange(memory)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select memory: ${truncateText(memory.human_input, 50)}`}
                      />
                    </td>
                    <td>{memory.base_model}</td>
                    <td title={memory.human_input}>{truncateText(memory.human_input, 600)}</td>
                    <td title={memory.ai_response}>{truncateText(memory.ai_response, 800)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="no-memories">
                    {searchTerm ? 'No memories match your search' : 'No memories available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Count */}
      <div className="selected-count">
        {selectedMemoryIds.length} {selectedMemoryIds.length === 1 ? 'memory' : 'memories'} selected
      </div>
    </div>
  );
};

export default MemoryPage;
