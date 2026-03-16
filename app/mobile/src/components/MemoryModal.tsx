import React, { useState, useEffect, useMemo } from 'react';
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
  Switch,
} from 'react-native';
import { useMemoryApi, Memory } from '@share/hooks/MemoryAPI';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@share/store';
import { storage } from '@share/utils/storage';
import { setShortTermMemory, setMessages } from '@share/store/slices/chatSlice';
import { Message } from '@share/types/ChatInterface.types';

export default function MemoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  
  const { fetchMemories, isLoading } = useMemoryApi();
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (visible && user) {
      loadMemories();
    }
  }, [visible, user]);

  const loadMemories = async () => {
    try {
      const fetched = await fetchMemories(user || 'peng');
      setMemories(fetched);
    } catch (err) {
      Alert.alert('Error', `Failed to fetch memories: ${err}`);
    }
  };

  const filteredMemories = useMemo(() => {
    if (!searchTerm.trim()) return memories;
    const lower = searchTerm.toLowerCase();
    return memories.filter(
      (m) =>
        m.human_input.toLowerCase().includes(lower) ||
        m.ai_response.toLowerCase().includes(lower) ||
        m.base_model.toLowerCase().includes(lower)
    );
  }, [searchTerm, memories]);

  const handleToggleSelect = (id: string) => {
    setSelectedMemoryIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    const selectedMemories = memories.filter((m) => selectedMemoryIds.includes(m.id));
    
    // Mimic web behavior: populate chat messages with selected memories
    const memoryMessages: Message[] = [];
    selectedMemories.forEach((memory) => {
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

    const selectedChatIds = selectedMemories
      .map((memory) => Number(memory.id))
      .filter((id) => Number.isInteger(id));
    
    dispatch(setShortTermMemory(selectedChatIds));

    Alert.alert('Success', `${selectedMemoryIds.length} memories loaded into chat.`);
    onClose();
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.modalText}>Memory Selection</Text>
            <View style={styles.headerActions}>
              {selectedMemoryIds.length > 0 && (
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Load</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search memories..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {isLoading ? (
            <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={styles.memoryList}>
              {filteredMemories.map((memory) => (
                <TouchableOpacity
                  key={memory.id}
                  style={[
                    styles.memoryCard,
                    selectedMemoryIds.includes(memory.id) && styles.memoryCardSelected,
                  ]}
                  onPress={() => handleToggleSelect(memory.id)}
                >
                  <View style={styles.memoryHeader}>
                    <Text style={styles.modelTag}>{memory.base_model}</Text>
                    <Switch
                      value={selectedMemoryIds.includes(memory.id)}
                      onValueChange={() => handleToggleSelect(memory.id)}
                    />
                  </View>
                  <Text style={styles.humanLabel}>You:</Text>
                  <Text style={styles.memoryText} numberOfLines={3}>
                    {memory.human_input}
                  </Text>
                  <Text style={styles.aiLabel}>AI:</Text>
                  <Text style={[styles.memoryText, styles.aiText]} numberOfLines={3}>
                    {memory.ai_response}
                  </Text>
                </TouchableOpacity>
              ))}
              {filteredMemories.length === 0 && (
                <Text style={styles.emptyText}>No memories found</Text>
              )}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {selectedMemoryIds.length} memories selected
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  modalText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6c757d',
  },
  searchInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  memoryList: {
    flex: 1,
  },
  memoryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  memoryCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#f0fff4',
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modelTag: {
    fontSize: 12,
    color: '#6c757d',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  humanLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 5,
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 8,
  },
  memoryText: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  aiText: {
    color: '#495057',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#adb5bd',
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '600',
  },
});
