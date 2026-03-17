import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useModelApi, Model } from '@share/hooks/ModelAPI';
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ModelModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    getAllModels,
    toggleModelAvailability,
    refreshModels,
    isLoading,
  } = useModelApi();

  const [models, setModels] = useState<Model[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');

  const fetchModels = useCallback(async () => {
    try {
      const fetchedModels = await getAllModels();
      setModels(fetchedModels || []);
    } catch {
      Alert.alert('Error', 'Failed to fetch models. Please check your connection.');
    }
  }, [getAllModels]);

  const handleRefresh = async () => {
    try {
      await refreshModels();
      await fetchModels();
      Alert.alert('Success', 'Models refreshed successfully');
    } catch (err) {
      Alert.alert('Error', `Failed to refresh models: ${err}`);
    }
  };

  const handleAvailabilityToggle = async (modelName: string) => {
    try {
      await toggleModelAvailability(modelName);
      setModels((prevModels) =>
        prevModels.map((model) =>
          model.model_name === modelName ? { ...model, isAvailable: !model.isAvailable } : model
        )
      );
    } catch (err) {
      Alert.alert('Error', `Failed to toggle availability: ${err}`);
    }
  };

  const operators = useMemo(() => Array.from(new Set(models.map((m) => m.operator))), [models]);

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const matchesSearch = model.model_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOperator = selectedOperator === '' || model.operator === selectedOperator;
      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && model.isAvailable) ||
        (availabilityFilter === 'unavailable' && !model.isAvailable);
      return matchesSearch && matchesOperator && matchesAvailability;
    });
  }, [models, searchTerm, selectedOperator, availabilityFilter]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      onShow={fetchModels}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.modalText}>Model Management</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={Colors.textDim} />
            </TouchableOpacity>
          </View>

          <View style={styles.controls}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search models..."
              placeholderTextColor={Colors.textMuted}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <MaterialCommunityIcons name="refresh" size={20} color={Colors.white} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity 
                  style={[styles.filterChip, selectedOperator === '' && styles.filterChipActive]}
                  onPress={() => setSelectedOperator('')}
                >
                  <Text style={[styles.filterChipText, selectedOperator === '' && styles.filterChipTextActive]}>All Operators</Text>
                </TouchableOpacity>
                {operators.map(op => (
                  <TouchableOpacity 
                    key={op}
                    style={[styles.filterChip, selectedOperator === op && styles.filterChipActive]}
                    onPress={() => setSelectedOperator(op)}
                  >
                    <Text style={[styles.filterChipText, selectedOperator === op && styles.filterChipTextActive]}>{op}</Text>
                  </TouchableOpacity>
                ))}
             </ScrollView>
          </View>

          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['all', 'available', 'unavailable'].map(filter => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, availabilityFilter === filter && styles.filterChipActive]}
                  onPress={() => setAvailabilityFilter(filter)}
                >
                  <Text style={[styles.filterChipText, availabilityFilter === filter && styles.filterChipTextActive]}>
                    {filter === 'all' ? 'All Status' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {isLoading && models.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <ScrollView 
              style={styles.modelList} 
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
            >
              {filteredModels.map((model) => (
                <View key={model.id} style={styles.modelCard}>
                  <View style={styles.modelHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelName} numberOfLines={1}>{model.model_name}</Text>
                      <Text style={styles.modelOperator}>{model.operator}</Text>
                    </View>
                    <Switch
                      value={model.isAvailable}
                      onValueChange={() => handleAvailabilityToggle(model.model_name)}
                      trackColor={{ false: Colors.bgHover, true: Colors.primarySoft }}
                      thumbColor={model.isAvailable ? Colors.primary : Colors.textMuted}
                    />
                  </View>
                </View>
              ))}
              {filteredModels.length === 0 && (
                <Text style={styles.noModels}>No models found matching your criteria.</Text>
              )}
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
    padding: Typography.spacing.lg,
    height: '95%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Typography.spacing.lg,
  },
  modalText: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.primary,
    letterSpacing: Typography.letterSpacing.tight,
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
  controls: {
    flexDirection: 'row',
    marginBottom: Typography.spacing.md,
    gap: Typography.spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
    paddingHorizontal: Typography.spacing.sm,
    paddingVertical: Typography.spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textMain,
    fontSize: Typography.sizes.base,
  },
  refreshButton: {
    backgroundColor: Colors.primary,
    width: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  filterRow: {
    marginBottom: Typography.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Typography.spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgDeep,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textDim,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  modelList: {
    flex: 1,
  },
  modelCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: Typography.spacing.md,
    marginBottom: Typography.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textMain,
  },
  modelOperator: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
    marginTop: 2,
  },
  noModels: {
    textAlign: 'center',
    marginTop: Typography.spacing.xl,
    color: Colors.textMuted,
    fontSize: Typography.sizes.base,
  },
});
