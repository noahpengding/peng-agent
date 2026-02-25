import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/apiUtils';
import { ModelInfo } from './ChatInterface.types';

interface UserProfile {
  username: string;
  email: string;
  api_token: string;
  default_base_model: string;
  default_output_model: string;
  default_embedding_model: string;
  system_prompt: string | null;
  long_term_memory: string[];
}

interface UserProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: ModelInfo[];
}

const UserProfilePopup: React.FC<UserProfilePopupProps> = ({ isOpen, onClose, availableModels }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('GET', '/user/profile');
      setProfile(data);
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        email: profile.email,
        default_base_model: profile.default_base_model,
        default_output_model: profile.default_output_model,
        default_embedding_model: profile.default_embedding_model,
        system_prompt: profile.system_prompt,
        long_term_memory: profile.long_term_memory,
        password: password || undefined,
      };

      await apiCall('PUT', '/user/profile', payload);
      onClose();
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemory = () => {
    if (newMemory.trim() && profile) {
      setProfile({
        ...profile,
        long_term_memory: [...profile.long_term_memory, newMemory.trim()],
      });
      setNewMemory('');
    }
  };

  const handleDeleteMemory = (index: number) => {
    if (profile) {
      const updatedMemory = [...profile.long_term_memory];
      updatedMemory.splice(index, 1);
      setProfile({
        ...profile,
        long_term_memory: updatedMemory,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content user-profile-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <h3>User Profile</h3>
          <div className="popup-actions">
            <button className="update-button" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="popup-body">
          {loading ? (
            <div className="loading-indicator">Loading profile...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : profile ? (
            <div className="profile-form">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input type="text" value={profile.username} disabled className="form-input form-select" style={{cursor: 'not-allowed', opacity: 0.7}} />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="form-input form-select"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="form-input form-select"
                />
              </div>

              <div className="form-group">
                <label className="form-label">API Token</label>
                <input
                  type="text"
                  value={profile.api_token}
                  onChange={(e) => setProfile({ ...profile, api_token: e.target.value })}
                  className="form-input form-select"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Base Model</label>
                <select
                  value={profile.default_base_model}
                  onChange={(e) => setProfile({ ...profile, default_base_model: e.target.value })}
                  className="form-select"
                >
                  <option value="">Select a model</option>
                  {availableModels.map(model => (
                    <option key={model.model_name} value={model.model_name}>{model.model_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Default Output Model</label>
                <select
                  value={profile.default_output_model}
                  onChange={(e) => setProfile({ ...profile, default_output_model: e.target.value })}
                  className="form-select"
                >
                  <option value="">Select a model</option>
                  {availableModels.map(model => (
                    <option key={model.model_name} value={model.model_name}>{model.model_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Default Embedding Model</label>
                <select
                  value={profile.default_embedding_model}
                  onChange={(e) => setProfile({ ...profile, default_embedding_model: e.target.value })}
                  className="form-select"
                >
                  <option value="">Select a model</option>
                  {availableModels.map(model => (
                    <option key={model.model_name} value={model.model_name}>{model.model_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">System Prompt</label>
                <textarea
                  value={profile.system_prompt || ''}
                  onChange={(e) => setProfile({ ...profile, system_prompt: e.target.value })}
                  className="form-textarea form-select"
                  rows={3}
                  style={{height: 'auto'}}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Long Term Memory</label>
                <div className="memory-list" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem'}}>
                  {profile.long_term_memory.map((mem, idx) => (
                    <div key={idx} className="memory-item" style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                      <input
                         type="text"
                         value={mem}
                         readOnly
                         className="form-input form-select"
                         style={{flex: 1}}
                      />
                      <button type="button" onClick={() => handleDeleteMemory(idx)} className="tool-remove-button">×</button>
                    </div>
                  ))}
                </div>
                <div className="add-memory" style={{display: 'flex', gap: '0.5rem'}}>
                  <input
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Add new memory..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                    className="form-input form-select"
                    style={{flex: 1}}
                  />
                  <button type="button" onClick={handleAddMemory} className="update-button" style={{padding: '0.5rem'}}>Add</button>
                </div>
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePopup;
