import React, { useState, useEffect } from 'react';
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

export default function ModelModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    getAllModels,
    toggleModelAvailability,
    toggleModelMultimodal,
    toggleModelReasoningEffect,
    refreshModels,
    isLoading,
  } = useModelApi();

  const [models, setModels] = useState<Model[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (visible) {
      fetchModels();
    }
  }, [visible]);

  const fetchModels = async () => {
    try {
      const fetchedModels = await getAllModels();
      setModels(fetchedModels);
    } catch (err) {
      setError(`Failed to fetch models: ${err}`);
    }
  };

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
    } catch (err) {
      Alert.alert('Error', `Failed to toggle multimodal: ${err}`);
    }
  };

  const handleModelReasoningEffect = async (modelName: string, effect: string) => {
    try {
      await toggleModelReasoningEffect(modelName, effect);
      setModels((prevModels) =>
        prevModels.map((model) =>
          model.model_name === modelName ? { ...model, reasoning_effect: effect } : model
        )
      );
    } catch (err) {
      Alert.alert('Error', `Failed to set reasoning effect: ${err}`);
    }
  };

  const operators = Array.from(new Set(models.map((m) => m.operator)));

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.model_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOperator = selectedOperator === '' || model.operator === selectedOperator;
    const matchesAvailability =
      availabilityFilter === 'all' ||
      (availabilityFilter === 'available' && model.isAvailable) ||
      (availabilityFilter === 'unavailable' && !model.isAvailable);
    return matchesSearch && matchesOperator && matchesAvailability;
  });

  const renderModalityIcon = (type: string, active: boolean) => {
    let emoji = '';
    switch (type) {
      case 'text': emoji = '📝'; break;
      case 'image': emoji = '🖼️'; break;
      case 'audio': emoji = '🔊'; break;
      case 'video': emoji = '🎥'; break;
    }
    return (
      <View style={[styles.modalityIcon, active && styles.modalityIconActive]}>
        <Text style={{ fontSize: 12 }}>{emoji}</Text>
      </View>
    );
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.modalText}>Model Management</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.controls}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search models..."
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={isLoading}
            >
              <Text style={styles.refreshButtonText}>
                {isLoading ? 'Refreshing...' : 'Refresh Models'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
             <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity 
                  style={[styles.filterChip, selectedOperator === '' && styles.filterChipActive]}
                  onPress={() => setSelectedOperator('')}
                >
                  <Text style={[styles.filterChipText, selectedOperator === '' && styles.filterChipTextActive]}>All</Text>
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

          {isLoading && models.length === 0 ? (
            <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={styles.modelList}>
              {filteredModels.map((model) => (
                <View key={model.id} style={styles.modelCard}>
                  <View style={styles.modelHeader}>
                    <View>
                      <Text style={styles.modelName}>{model.model_name}</Text>
                      <Text style={styles.modelOperator}>{model.operator}</Text>
                    </View>
                    <Switch
                      value={model.isAvailable}
                      onValueChange={() => handleAvailabilityToggle(model.model_name)}
                    />
                  </View>

                  <View style={styles.modalitySection}>
                    <Text style={styles.sectionLabel}>Input Modalities:</Text>
                    <View style={styles.modalityRow}>
                      <TouchableOpacity onPress={() => handleModelMultimodal(model.model_name, 'input_text')}>
                        {renderModalityIcon('text', model.input_text)}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleModelMultimodal(model.model_name, 'input_image')}>
                        {renderModalityIcon('image', model.input_image)}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleModelMultimodal(model.model_name, 'input_audio')}>
                        {renderModalityIcon('audio', model.input_audio)}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleModelMultimodal(model.model_name, 'input_video')}>
                        {renderModalityIcon('video', model.input_video)}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.modalitySection}>
                    <Text style={styles.sectionLabel}>Output Modalities:</Text>
                    <View style={styles.modalityRow}>
                      <TouchableOpacity onPress={() => handleModelMultimodal(model.model_name, 'output_text')}>
                        {renderModalityIcon('text', model.output_text)}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleModelMultimodal(model.model_name, 'output_image')}>
                        {renderModalityIcon('image', model.output_image)}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleModelMultimodal(model.model_name, 'output_audio')}>
                        {renderModalityIcon('audio', model.output_audio)}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleModelMultimodal(model.model_name, 'output_video')}>
                        {renderModalityIcon('video', model.output_video)}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.reasoningSection}>
                    <Text style={styles.sectionLabel}>Reasoning Effect:</Text>
                    <View style={styles.reasoningButtons}>
                      {['not a reasoning model', 'low', 'medium', 'high'].map((effect) => (
                        <TouchableOpacity
                          key={effect}
                          style={[
                            styles.reasoningButton,
                            model.reasoning_effect === effect && styles.reasoningButtonActive,
                          ]}
                          onPress={() => handleModelReasoningEffect(model.model_name, effect)}
                        >
                          <Text
                            style={[
                              styles.reasoningButtonText,
                              model.reasoning_effect === effect && styles.reasoningButtonTextActive,
                            ]}
                          >
                            {effect === 'not a reasoning model' ? 'None' : effect.charAt(0).toUpperCase() + effect.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
              {filteredModels.length === 0 && (
                <Text style={styles.noModels}>No models found matching your criteria.</Text>
              )}
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
    marginBottom: 20,
  },
  modalText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6c757d',
  },
  controls: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  filterRow: {
    marginBottom: 15,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    color: '#495057',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: 'white',
  },
  modelList: {
    flex: 1,
  },
  modelCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modelOperator: {
    fontSize: 14,
    color: '#6c757d',
  },
  modalitySection: {
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 5,
  },
  modalityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalityIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalityIconActive: {
    backgroundColor: '#e7f3ff',
    borderColor: '#007AFF',
  },
  reasoningSection: {
    marginTop: 5,
  },
  reasoningButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasoningButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#f8f9fa',
  },
  reasoningButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  reasoningButtonText: {
    fontSize: 12,
    color: '#495057',
  },
  reasoningButtonTextActive: {
    color: 'white',
  },
  noModels: {
    textAlign: 'center',
    marginTop: 20,
    color: '#6c757d',
  },
});
