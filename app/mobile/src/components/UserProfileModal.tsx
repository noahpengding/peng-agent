import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useUserApi, UserProfile } from '@share/hooks/UserAPI';
import { ModelInfo } from '@share/types/ChatInterface.types';
import { Colors } from '../utils/colors';

export default function UserProfileModal({ 
  visible, 
  onClose, 
  availableModels = [] 
}: { 
  visible: boolean; 
  onClose: () => void;
  availableModels?: ModelInfo[];
}) {
  const { getProfile, updateProfile, regenerateToken, isLoading } = useUserApi();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [newMemory, setNewMemory] = useState('');
  const [regeneratingToken, setRegeneratingToken] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch {
      Alert.alert('Error', 'Failed to load profile');
    }
  }, [getProfile]);

  useEffect(() => {
    if (visible) {
      fetchProfile();
    }
  }, [visible, fetchProfile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
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
      Alert.alert('Success', 'Profile updated successfully');
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save profile');
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

  const handleRegenerateToken = async () => {
    if (!profile) return;
    setRegeneratingToken(true);
    try {
      const response = await regenerateToken();
      setProfile({ ...profile, api_token: response.api_token });
      Alert.alert('Success', 'API Token regenerated');
    } catch {
      Alert.alert('Error', 'Failed to regenerate token');
    } finally {
      setRegeneratingToken(false);
    }
  };

  if (!profile && isLoading) {
    return (
      <Modal visible={visible} transparent>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.modalText}>User Profile</Text>
            <View style={styles.headerActions}>
               <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>{saving ? '...' : 'Save'}</Text>
               </TouchableOpacity>
               <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
               </TouchableOpacity>
            </View>
          </View>

          {profile && (
            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput style={[styles.input, styles.disabledInput]} value={profile.username} editable={false} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={profile.email}
                  onChangeText={(text) => setProfile({ ...profile, email: text })}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Leave blank to keep current"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>API Token</Text>
                <View style={styles.tokenRow}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={profile.api_token} editable={false} />
                  <TouchableOpacity 
                    style={styles.tokenButton} 
                    onPress={handleRegenerateToken}
                    disabled={regeneratingToken}
                  >
                    <Text style={styles.tokenButtonText}>{regeneratingToken ? '...' : '🔄'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Default Models</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Base Model</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modelPicker}>
                  {availableModels.map(m => (
                    <TouchableOpacity 
                      key={m.model_name}
                      style={[styles.modelChip, profile.default_base_model === m.model_name && styles.modelChipActive]}
                      onPress={() => setProfile({...profile, default_base_model: m.model_name})}
                    >
                      <Text style={[styles.modelChipText, profile.default_base_model === m.model_name && styles.modelChipTextActive]}>
                        {m.model_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Output Model</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modelPicker}>
                  {availableModels.map(m => (
                    <TouchableOpacity 
                      key={m.model_name}
                      style={[styles.modelChip, profile.default_output_model === m.model_name && styles.modelChipActive]}
                      onPress={() => setProfile({...profile, default_output_model: m.model_name})}
                    >
                      <Text style={[styles.modelChipText, profile.default_output_model === m.model_name && styles.modelChipTextActive]}>
                        {m.model_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Storage (S3)</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Access Key</Text>
                <TextInput
                  style={styles.input}
                  value={profile.s3_access_key}
                  onChangeText={(text) => setProfile({ ...profile, s3_access_key: text })}
                  placeholder="System default"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Secret Key</Text>
                <TextInput
                  style={styles.input}
                  value={profile.s3_secret_key}
                  onChangeText={(text) => setProfile({ ...profile, s3_secret_key: text })}
                  placeholder="System default"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>System Prompt</Text>
                <TextInput
                  style={[styles.input, { height: 100 }]}
                  value={profile.system_prompt || ''}
                  onChangeText={(text) => setProfile({ ...profile, system_prompt: text })}
                  multiline
                  placeholder="Enter system prompt..."
                />
              </View>

              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Long Term Memory</Text>

              <View style={styles.memorySection}>
                {profile.long_term_memory.map((mem, idx) => (
                  <View key={idx} style={styles.memoryItem}>
                    <Text style={styles.memoryText}>{mem}</Text>
                    <TouchableOpacity onPress={() => handleDeleteMemory(idx)}>
                      <Text style={styles.deleteMemoryText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                
                <View style={styles.addMemoryRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    value={newMemory}
                    onChangeText={setNewMemory}
                    placeholder="Add new memory..."
                  />
                  <TouchableOpacity 
                    style={styles.addButton} 
                    onPress={handleAddMemory}
                    disabled={!newMemory.trim()}
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    height: '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  modalText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveButtonText: {
    color: Colors.white,
    fontWeight: '800',
  },
  closeButton: {
    padding: 5,
    backgroundColor: Colors.bgDeep,
    borderRadius: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: Colors.bgDeep,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.textMain,
  },
  disabledInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: Colors.textMuted,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenButton: {
    backgroundColor: Colors.bgDeep,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tokenButtonText: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 18,
  },
  modelPicker: {
    flexDirection: 'row',
  },
  modelChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.bgDeep,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modelChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  modelChipText: {
    fontSize: 14,
    color: Colors.textDim,
    fontWeight: '600',
  },
  modelChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  memorySection: {
    gap: 12,
  },
  memoryItem: {
    flexDirection: 'row',
    backgroundColor: Colors.bgDeep,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memoryText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textDim,
  },
  deleteMemoryText: {
    fontSize: 18,
    color: Colors.error,
    paddingLeft: 12,
    fontWeight: '700',
  },
  addMemoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addButton: {
    backgroundColor: Colors.bgDeep,
    borderWidth: 1,
    borderColor: Colors.secondary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addButtonText: {
    color: Colors.secondary,
    fontWeight: '800',
  },
});
