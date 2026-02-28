import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModelApi, Model } from '../hooks/ModelAPI';
import './ModelInterface.css';

const ModelInterface: React.FC = () => {
  const navigate = useNavigate();
  const { getAllModels, toggleModelAvailability, toggleModelMultimodal, toggleModelReasoningEffect, refreshModels, isLoading } = useModelApi();

  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter states
  const [operators, setOperators] = useState<string[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');

  const [error, setError] = useState<string>('');

  // Load models on initial render
  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters when models or filter criteria change
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, selectedOperator, availabilityFilter, searchTerm]);

  // Extract unique operators and types for filters
  useEffect(() => {
    if (models.length > 0) {
      const uniqueOperators = Array.from(new Set(models.map((model) => model.operator)));

      setOperators(uniqueOperators);
    }
  }, [models]);

  const fetchModels = async () => {
    try {
      const fetchedModels = await getAllModels();
      setModels(fetchedModels);
    } catch (error) {
      setError(`Failed to refresh models: ${error}`);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshModels();
      await fetchModels(); // Refresh the model list after refresh call
    } catch (error) {
      setError(`Failed to refresh models: ${error}`);
    }
  };

  const handleAvailabilityToggle = async (modelName: string) => {
    try {
      await toggleModelAvailability(modelName);
      // Update the local state to reflect the change
      setModels((prevModels) => prevModels.map((model) => (model.model_name === modelName ? { ...model, isAvailable: !model.isAvailable } : model)));
    } catch (error) {
      setError(`Failed to toggle availability for model ${modelName}: ${error}`);
    }
  };

  const handleModelMultimodal = async (modelName: string, column: keyof Model) => {
    try {
      await toggleModelMultimodal(modelName, column as string);
      setModels((prevModels) =>
        prevModels.map((model) =>
          model.model_name === modelName
            ? {
                ...model,
                [column]: !model[column],
              }
            : model
        )
      );
    } catch (error) {
      setError(`Failed to toggle multimodal for model ${modelName}: ${error}`);
    }
  };

  const renderModalityButtons = (model: Model, column: 'input' | 'output') => {
    const items = [
      { key: `${column}_text` as keyof Model, label: 'Text', icon: 'text' },
      { key: `${column}_image` as keyof Model, label: 'Image', icon: 'image' },
      { key: `${column}_audio` as keyof Model, label: 'Audio', icon: 'audio' },
      { key: `${column}_video` as keyof Model, label: 'Video', icon: 'video' },
    ];

    const renderIcon = (icon: 'text' | 'image' | 'audio' | 'video') => {
      switch (icon) {
        case 'text':
          return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="modality-icon">
              <path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          );
        case 'image':
          return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="modality-icon">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              <circle cx="9" cy="10" r="2" fill="currentColor" />
              <path d="M7 17l4-4 3 3 3-3 4 4" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          );
        case 'audio':
          return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="modality-icon">
              <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
              <path d="M16 9a4 4 0 010 6M18.5 6.5a7 7 0 010 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          );
        case 'video':
          return (
            <svg viewBox="0 0 24 24" aria-hidden="true" className="modality-icon">
              <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M15 10l6-4v12l-6-4" fill="currentColor" />
            </svg>
          );
      }
    };

    return (
      <div className="modality-grid">
        {items.map((item) => (
          <button
            key={item.key}
            className={`modality-button ${model[item.key] ? 'active' : 'inactive'}`}
            onClick={() => handleModelMultimodal(model.model_name, item.key)}
            type="button"
            aria-pressed={Boolean(model[item.key])}
            aria-label={`${column} ${item.label}`}
            title={`${column} ${item.label}`}
          >
            {renderIcon(item.icon as 'text' | 'image' | 'audio' | 'video')}
          </button>
        ))}
      </div>
    );
  };

  const handleModelReasoningEffect = async (modelName: string, reasoningEffect: string) => {
    try {
      await toggleModelReasoningEffect(modelName, reasoningEffect);
      setModels((prevModels) =>
        prevModels.map((model) => (model.model_name === modelName ? { ...model, reasoning_effect: reasoningEffect } : model))
      );
    } catch (error) {
      setError(`Failed to toggle reasoning effect for model ${modelName}: ${error}`);
    }
  };

  const applyFilters = () => {
    let result = [...models];

    // Apply search filter
    if (searchTerm) {
      result = result.filter((model) => model.model_name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Apply operator filter
    if (selectedOperator) {
      result = result.filter((model) => model.operator === selectedOperator);
    }

    // Apply availability filter
    if (availabilityFilter !== 'all') {
      const isAvailable = availabilityFilter === 'available';
      result = result.filter((model) => model.isAvailable === isAvailable);
    }

    setFilteredModels(result);
  };

  return (
    <div className="model-container">
      {error && <div className="error-message">{error}</div>}

      <div className="main-content">
        {/* Sidebar with filters */}
        <div className="sidebar">
          <button className="home-button" onClick={() => navigate('/')}>
            Back to Home
          </button>

          <div className="sidebar-title">Filters</div>

          <div className="filters">
            {/* Operator Filter */}
            <div className="filter-group">
              <div className="filter-title">Operator</div>
              <select className="form-select" value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)}>
                <option value="">All Operators</option>
                {operators.map((operator) => (
                  <option key={operator} value={operator}>
                    {operator}
                  </option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="filter-group">
              <div className="filter-title">Availability</div>
              <select className="form-select" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
                <option value="all">All Models</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>
        </div>

        {/* Models main area */}
        <div className="models-area">
          <div className="models-header">
            <div className="search-box">
              <input
                type="text"
                className="search-input"
                placeholder="Search by model name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="search-button">Search</button>
            </div>
            <button className="refresh-button" onClick={handleRefresh} disabled={isLoading}>
              Refresh Models
            </button>
          </div>

          {isLoading ? (
            <div className="loading">Loading models...</div>
          ) : (
            <div className="table-container">
              {filteredModels.length > 0 ? (
                <table className="models-table">
                  <thead>
                    <tr>
                      <th>Operator</th>
                      <th>Model Name</th>
                      <th>Available</th>
                      <th>Input</th>
                      <th>Output</th>
                      <th>Reasoning Effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModels.map((model) => (
                      <tr key={model.id}>
                        <td>{model.operator}</td>
                        <td>{model.model_name}</td>
                        <td>
                          <input
                            type="checkbox"
                            className="availability-checkbox"
                            checked={model.isAvailable}
                            onChange={() => handleAvailabilityToggle(model.model_name)}
                          />
                        </td>
                        <td className="modality-cell">{renderModalityButtons(model, 'input')}</td>
                        <td className="modality-cell">{renderModalityButtons(model, 'output')}</td>
                        <td>
                          <select
                            className="reasoning-effect-select"
                            value={model.reasoning_effect}
                            onChange={(e) => handleModelReasoningEffect(model.model_name, e.target.value)}
                          >
                            <option value="not a reasoning model">Not a Reasoning Model</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-models">{models.length === 0 ? 'No models found. Try refreshing.' : 'No models match your filters.'}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelInterface;
