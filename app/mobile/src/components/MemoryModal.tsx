import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { setShortTermMemory, setMessages } from '@share/store/slices/chatSlice';
import { Message } from '@share/types/ChatInterface.types';
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';

export default function MemoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  
  const { fetchMemories, isLoading } = useMemoryApi();
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();

  const loadMemories = useCallback(async () => {
    if (!user) return;
    try {
      const fetched = await fetchMemories(user);
      setMemories(fetched);
    } catch (err) {
      Alert.alert('Error', `Failed to fetch memories: ${err}`);
    }
  }, [fetchMemories, user]);

  useEffect(() => {
    if (visible && user) {
      loadMemories();
    }
  }, [visible, user, loadMemories]);

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
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Typography.spacing.lg,
    height: '90%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Typography.spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Typography.spacing.sm,
  },
  modalText: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Typography.spacing.sm,
    paddingVertical: Typography.spacing['2xs'],
    borderRadius: 10,
  },
  saveButtonText: {
    color: Colors.white,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.sm,
    textTransform: 'uppercase',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: Typography.sizes.xl,
    color: Colors.textDim,
  },
  searchInput: {
    backgroundColor: Colors.bgDeep,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Typography.spacing.sm,
    marginBottom: Typography.spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.textMain,
  },
  memoryList: {
    flex: 1,
  },
  memoryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: Typography.spacing.md,
    marginBottom: Typography.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  memoryCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modelTag: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary,
    backgroundColor: Colors.bgDeep,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: Typography.weights.bold,
  },
  humanLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    color: Colors.primary,
    marginTop: Typography.spacing['3xs'],
    textTransform: 'uppercase',
  },
  aiLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    color: Colors.secondary,
    marginTop: Typography.spacing['2xs'],
    textTransform: 'uppercase',
  },
  memoryText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMain,
    marginTop: 2,
    lineHeight: Typography.sizes.sm * Typography.lineHeights.normal,
  },
  aiText: {
    color: Colors.textDim,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Typography.spacing.xl,
    color: Colors.textMuted,
    fontSize: Typography.sizes.base,
  },
  footer: {
    paddingTop: Typography.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontWeight: Typography.weights.semibold,
  },
});
