import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMemoryApi, Memory } from '../hooks/MemoryAPI';
import { useAuth } from '../contexts/AuthContext';
import './MemorySelection.css';

const MemoryPage: React.FC = () => {
    // State variables
    const [memories, setMemories] = useState<Memory[]>([]);
    const [filteredMemories, setFilteredMemories] = useState<Memory[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Hooks
    const navigate = useNavigate();
    const { fetchMemories, isLoading } = useMemoryApi();
    const { user } = useAuth();

    // Fetch memories on component mount
    useEffect(() => {
        const getMemories = async (username: string) => {
            try {
                const fetchedMemories = await fetchMemories(username);
                setMemories(fetchedMemories);
                setFilteredMemories(fetchedMemories);
            } catch (error) {
                setError(`Failed to fetch memories: ${error}`);
            }
        };
        // Only fetch after user is available
        if (user) {
            getMemories(user);
        }
    }, [user]);

    // Filter memories based on search term
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredMemories(memories);
            return;
        }
        
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filtered = memories.filter(memory => 
            memory.human_input.toLowerCase().includes(lowerCaseSearchTerm) ||
            memory.ai_response.toLowerCase().includes(lowerCaseSearchTerm)
        );
        
        setFilteredMemories(filtered);
    }, [searchTerm, memories]);

    // Handle checkbox change
    const handleCheckboxChange = (id: string) => {
        setSelectedMemoryIds(prevSelectedIds => {
            if (prevSelectedIds.includes(id)) {
                return prevSelectedIds.filter(selectedId => selectedId !== id);
            } else {
                return [...prevSelectedIds, id];
            }
        });
    };

    // Handle primary button click - save if memories are selected, otherwise exit
    const handlePrimaryAction = () => {
        if (selectedMemoryIds.length > 0) {
            // Save selected memories
            const selectedMemories = memories.filter(memory => 
                selectedMemoryIds.includes(memory.id)
            );
            localStorage.setItem('selectedMemories', JSON.stringify(selectedMemories));
        }
        
        // In all cases, navigate back to chat interface
        navigate('/');
    };

    // Truncate text for display
    const truncateText = (text: string, maxLength: number = 100) => {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    };
    
    return (
        <div className="memory-selection-container">
            <h1 className="memory-selection-title">Memory Selection</h1>
            
            {/* Search Bar */}
            <div className="search-container">
                <input 
                    type="text" 
                    placeholder="Search memories..." 
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            {/* Merged Action Button */}
            <div className="action-buttons">
                <button 
                    className="primary-button"
                    onClick={handlePrimaryAction}
                >
                    {selectedMemoryIds.length > 0 ? `Save ${selectedMemoryIds.length} Selected Memories` : 'Return to Chat'}
                </button>
            </div>
            
            {/* Loading and Error States */}
            {isLoading && <div className="loading-indicator">Loading memories...</div>}
            {error && <div className="error-message">Error: {error}</div>}
            
            {/* Memories Table */}
            {!isLoading && !error && (
                <div className="memories-table-container">
                    <table className="memories-table">
                        <thead>
                            <tr>
                                <th className="select-column">Select</th>
                                <th className="model-column">Model</th>
                                <th className="kb-column">Knowledge Base</th>
                                <th className="human-input-column">Human Input</th>
                                <th className="ai-response-column">AI Response</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMemories.length > 0 ? (
                                filteredMemories.map((memory) => (
                                    <tr key={memory.id}>
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedMemoryIds.includes(memory.id)}
                                                onChange={() => handleCheckboxChange(memory.id)}
                                            />
                                        </td>
                                        <td>{memory.base_model}</td>
                                        <td>{memory.knowledge_base}</td>
                                        <td title={memory.human_input}>
                                            {truncateText(memory.human_input)}
                                        </td>
                                        <td title={memory.ai_response}>
                                            {truncateText(memory.ai_response, 200)}  {/* Increased truncate length */}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="no-memories">
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
