import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { useMemoryApi } from '@/hooks/MemoryAPI';
import type { Memory } from '@/hooks/MemoryAPI';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { setShortTermMemory, setMessages } from '@/store/slices/chatSlice';
import { Message } from '@/types/ChatInterface.types';
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';

export default function MemoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemoriesById, setSelectedMemoriesById] = useState<Record<string, Memory>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  
  const { fetchMemories, isLoading } = useMemoryApi();
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();

  const selectedMemoryIds = useMemo(() => Object.keys(selectedMemoriesById), [selectedMemoriesById]);

  useEffect(() => {
    let mounted = true;

    const loadMemories = async () => {
      if (!visible || !user) return;
      try {
        const response = await fetchMemories(user, currentPage, searchTerm);
        if (!mounted) return;
        setMemories(response.memories);
        setCurrentPage(response.page);
        setTotalPages(response.total_pages);
        setTotalCount(response.total_count);
        setHasNextPage(response.has_next);
        setHasPreviousPage(response.has_previous);
      } catch (err) {
        if (mounted) {
          Alert.alert('Error', `Failed to fetch memories: ${err}`);
        }
      }
    };

    loadMemories();

    return () => {
      mounted = false;
    };
  }, [visible, user, currentPage, searchTerm, fetchMemories]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleToggleSelect = (memory: Memory) => {
    setSelectedMemoriesById((prev) => {
      const next = { ...prev };
      if (next[memory.id]) {
        delete next[memory.id];
      } else {
        next[memory.id] = memory;
      }
      return next;
    });
  };

  const handleSave = async () => {
    const selectedMemories = Object.values(selectedMemoriesById);
    
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

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((page) => Math.max(page - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  }, [totalPages]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
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
            onChangeText={handleSearchChange}
            placeholderTextColor={Colors.textMuted}
          />

          {isLoading ? (
            <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={styles.memoryList}>
              {memories.map((memory) => (
                <TouchableOpacity
                  key={memory.id}
                  style={[
                    styles.memoryCard,
                    selectedMemoryIds.includes(memory.id) && styles.memoryCardSelected,
                  ]}
                  onPress={() => handleToggleSelect(memory)}
                >
                  <View style={styles.memoryHeader}>
                    <Text style={styles.modelTag}>{memory.base_model}</Text>
                    <Switch
                      value={selectedMemoryIds.includes(memory.id)}
                      onValueChange={() => handleToggleSelect(memory)}
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
              {memories.length === 0 && (
                <Text style={styles.emptyText}>
                  {searchTerm ? 'No memories match your search' : 'No memories found'}
                </Text>
              )}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageButton, (!hasPreviousPage || isLoading) && styles.pageButtonDisabled]}
                onPress={handlePreviousPage}
                disabled={!hasPreviousPage || isLoading}
              >
                <Text style={[styles.pageButtonText, (!hasPreviousPage || isLoading) && styles.pageButtonTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>
              <View style={styles.pageStatus}>
                <Text style={styles.pageStatusText}>Page {currentPage} of {totalPages}</Text>
                {totalCount > 0 && <Text style={styles.pageTotalText}>{totalCount} memories</Text>}
              </View>
              <TouchableOpacity
                style={[styles.pageButton, (!hasNextPage || isLoading) && styles.pageButtonDisabled]}
                onPress={handleNextPage}
                disabled={!hasNextPage || isLoading}
              >
                <Text style={[styles.pageButtonText, (!hasNextPage || isLoading) && styles.pageButtonTextDisabled]}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>
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
  paginationRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Typography.spacing.xs,
    marginBottom: Typography.spacing.xs,
  },
  pageButton: {
    minWidth: 84,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Typography.spacing.xs,
    paddingVertical: Typography.spacing['2xs'],
    backgroundColor: Colors.bgCard,
  },
  pageButtonDisabled: {
    opacity: 0.45,
  },
  pageButtonText: {
    color: Colors.textMain,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  pageButtonTextDisabled: {
    color: Colors.textMuted,
  },
  pageStatus: {
    flex: 1,
    alignItems: 'center',
  },
  pageStatusText: {
    color: Colors.textDim,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  pageTotalText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  footerText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontWeight: Typography.weights.semibold,
  },
});
