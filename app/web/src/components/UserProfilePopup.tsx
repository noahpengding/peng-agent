import React, { useState, useEffect, useCallback } from 'react';
import { ModelInfo } from '@/types/ChatInterface.types';
import { useUserApi, UserProfile } from '@/hooks/UserAPI';
import './UserProfilePopup.css';

interface UserProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: ModelInfo[];
}

const UserProfilePopup: React.FC<UserProfilePopupProps> = ({ isOpen, onClose, availableModels }) => {
  const { getProfile, updateProfile, regenerateToken } = useUserApi();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState('');
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const getProfileRef = React.useRef(getProfile);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProfileRef.current();
      setProfile(data);
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []); // stable — no changing deps

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen, fetchProfile]);

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
        s3_access_key: profile.s3_access_key,
        s3_secret_key: profile.s3_secret_key,
        system_prompt: profile.system_prompt,
        long_term_memory: profile.long_term_memory,
        password: password.trim() ? password.trim() : undefined,
      };

      await updateProfile(payload);
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

  const handleCopyToken = () => {
    if (profile?.api_token) {
      navigator.clipboard.writeText(profile.api_token);
    }
  };

  const handleRegenerateToken = async () => {
    if (!profile) return;
    setRegeneratingToken(true);
    try {
      const response = await regenerateToken();
      setProfile({ ...profile, api_token: response.api_token });
      window.location.reload();
    } catch {
      setError('Failed to regenerate token');
    } finally {
      setRegeneratingToken(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="popup-overlay"
      onClick={onClose}
    >
      <div
        className="popup-content user-profile-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-header">
          <h3>User Profile</h3>
          <div className="popup-actions">
            <button
              className="update-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              className="close-button"
              onClick={onClose}
              aria-label="Close user profile"
            >
              ×
            </button>
          </div>
        </div>

        <div className="popup-body">
          {loading ? (
            <div className="loading-indicator">Loading profile...</div>
          ) : error ? (
            <div className="error-message" role="alert" aria-live="assertive">{error}</div>
          ) : profile ? (
            <div className="profile-form">
              <div className="form-group">
                <label htmlFor="username" className="form-label">Username</label>
                <input id="username" type="text" value={profile.username} disabled className="form-input form-select disabled-input" />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="form-input form-select"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="form-input form-select"
                />
              </div>

              <div className="form-group">
                <label htmlFor="api_token" className="form-label">API Token</label>
                <div className="api-token-container">
                  <input id="api_token" type="text" value={profile.api_token} readOnly className="form-input form-select api-token-input" />
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="token-action-button"
                    title="Copy Token"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateToken}
                    disabled={regeneratingToken}
                    className="token-action-button"
                    title="Regenerate Token"
                  >
                    {regeneratingToken ? '...' : 'Regenerate'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="default_base_model" className="form-label">Default Base Model</label>
                <select
                  id="default_base_model"
                  value={profile.default_base_model}
                  onChange={(e) => setProfile({ ...profile, default_base_model: e.target.value })}
                  className="form-select"
                >
                  <option value="">Select a model</option>
                  {availableModels.map((model) => (
                    <option key={model.model_name} value={model.model_name}>
                      {model.model_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="default_output_model" className="form-label">Default Output Model</label>
                <select
                  id="default_output_model"
                  value={profile.default_output_model}
                  onChange={(e) => setProfile({ ...profile, default_output_model: e.target.value })}
                  className="form-select"
                >
                  <option value="">Select a model</option>
                  {availableModels.map((model) => (
                    <option key={model.model_name} value={model.model_name}>
                      {model.model_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="default_embedding_model" className="form-label">Default Embedding Model</label>
                <select
                  id="default_embedding_model"
                  value={profile.default_embedding_model}
                  onChange={(e) => setProfile({ ...profile, default_embedding_model: e.target.value })}
                  className="form-select"
                >
                  <option value="">Select a model</option>
                  {availableModels.map((model) => (
                    <option key={model.model_name} value={model.model_name}>
                      {model.model_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="s3_access_key" className="form-label">S3 Access Key</label>
                <input
                  id="s3_access_key"
                  type="text"
                  value={profile.s3_access_key}
                  onChange={(e) => setProfile({ ...profile, s3_access_key: e.target.value })}
                  placeholder="Leave blank to use system default"
                  className="form-input form-select"
                />
              </div>

              <div className="form-group">
                <label htmlFor="s3_secret_key" className="form-label">S3 Secret Key</label>
                <input
                  id="s3_secret_key"
                  type="password"
                  value={profile.s3_secret_key}
                  onChange={(e) => setProfile({ ...profile, s3_secret_key: e.target.value })}
                  placeholder="Leave blank to use system default"
                  className="form-input form-select"
                />
              </div>

              <div className="form-group">
                <label htmlFor="system_prompt" className="form-label">System Prompt</label>
                <textarea
                  id="system_prompt"
                  value={profile.system_prompt || ''}
                  onChange={(e) => setProfile({ ...profile, system_prompt: e.target.value })}
                  className="form-textarea form-select"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="new_memory" className="form-label">Long Term Memory</label>
                <div className="memory-list">
                  {profile.long_term_memory.map((mem, idx) => (
                    <div
                      key={`${mem}-${idx}`}
                      className="memory-item"
                    >
                      <input type="text" value={mem} readOnly className="form-input form-select memory-item-input" aria-label={`Memory ${idx + 1}`} />
                      <button type="button" onClick={() => handleDeleteMemory(idx)} className="tool-remove-button" aria-label="Remove memory">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="add-memory-container">
                  <input
                    id="new_memory"
                    type="text"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Add new memory..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                    className="form-input form-select add-memory-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddMemory}
                    className="update-button add-memory-button"
                    disabled={!newMemory.trim()}
                  >
                    Add
                  </button>
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
