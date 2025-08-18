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
  const [types, setTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
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
  }, [models, selectedOperator, selectedType, availabilityFilter, searchTerm]);

  // Extract unique operators and types for filters
  useEffect(() => {
    if (models.length > 0) {
      const uniqueOperators = Array.from(new Set(models.map((model) => model.operator)));
      const uniqueTypes = Array.from(new Set(models.map((model) => model.type)));

      setOperators(uniqueOperators);
      setTypes(uniqueTypes);
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

  const handleModelMultimodal = async (modelName: string) => {
    try {
      await toggleModelMultimodal(modelName);
      // Update the local state to reflect the change
      setModels((prevModels) =>
        prevModels.map((model) => (model.model_name === modelName ? { ...model, isMultimodal: !model.isMultimodal } : model))
      );
    } catch (error) {
      setError(`Failed to toggle multimodal for model ${modelName}: ${error}`);
    }
  };

  const handleModelReasoingEffect = async (modelName: string, reasoningEffect: string) => {
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

    // Apply type filter
    if (selectedType) {
      result = result.filter((model) => model.type === selectedType);
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
      <div className="header">
        <div className="header-title">Model Management</div>
        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="main-content">
        {/* Sidebar with filters */}
        <div className="sidebar">
          <div className="home-button" onClick={() => navigate('/')} role="button">
            Back to Home
          </div>

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

            {/* Type Filter */}
            <div className="filter-group">
              <div className="filter-title">Type</div>
              <select className="form-select" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                <option value="">All Types</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
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
                      <th>Type</th>
                      <th>Model Name</th>
                      <th>Available</th>
                      <th>Multimodal</th>
                      <th>Reasoning Effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModels.map((model) => (
                      <tr key={model.id}>
                        <td>{model.operator}</td>
                        <td>{model.type}</td>
                        <td>{model.model_name}</td>
                        <td>
                          <input
                            type="checkbox"
                            className="availability-checkbox"
                            checked={model.isAvailable}
                            onChange={() => handleAvailabilityToggle(model.model_name)}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            className="multimodal-checkbox"
                            checked={model.isMultimodal}
                            onChange={() => handleModelMultimodal(model.model_name)}
                          />
                        </td>
                        <td>
                          <select
                            className="reasoning-effect-select"
                            value={model.reasoning_effect}
                            onChange={(e) => handleModelReasoingEffect(model.model_name, e.target.value)}
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
