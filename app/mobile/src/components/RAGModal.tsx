import React, { useState, useEffect } from 'react';
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
  FlatList,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRAGApi, RAGDocument } from '@share/hooks/RAGAPI';
import { UploadService } from '@share/services/uploadService';
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';

export default function RAGModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<RAGDocument[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<string[]>([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string>('');
  
  const [filePath, setFilePath] = useState<string>('');
  const [collectionName, setCollectionName] = useState<string>('');
  const [typeOfFile, setTypeOfFile] = useState<'standard' | 'handwriting'>('standard');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [indexResult, setIndexResult] = useState<string>('');

  const { getAllRAGDocuments, indexDocument, isLoading } = useRAGApi();

  useEffect(() => {
    if (visible) {
      loadDocuments();
    }
  }, [visible]);

  useEffect(() => {
    if (documents.length > 0) {
      const uniqueKnowledgeBases = Array.from(new Set(documents.map((doc) => doc.knowledge_base)));
      setKnowledgeBases(uniqueKnowledgeBases);
    }
  }, [documents]);

  useEffect(() => {
    if (selectedKnowledgeBase) {
      setFilteredDocuments(documents.filter((doc) => doc.knowledge_base === selectedKnowledgeBase));
    } else {
      setFilteredDocuments(documents);
    }
  }, [selectedKnowledgeBase, documents]);

  const loadDocuments = async () => {
    try {
      const docs = await getAllRAGDocuments();
      setDocuments(docs);
      setFilteredDocuments(docs);
    } catch (err) {
      Alert.alert('Error', `Failed to load documents: ${err}`);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      setIsUploading(true);
      setIndexResult('');

      // Read file as base64
      const base64Content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const contentType = asset.mimeType || 'application/octet-stream';
      const fileDataUri = `data:${contentType};base64,${base64Content}`;

      const [uploadPath, success] = await UploadService.uploadFile(fileDataUri, contentType, asset.name);

      if (success) {
        setFilePath(uploadPath);
        setIndexResult(`Uploaded: ${asset.name}`);
        // Default collection name to file name without extension if empty
        if (!collectionName) {
            setCollectionName(asset.name.split('.')[0]);
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      Alert.alert('Error', `Failed to upload document: ${err}`);
    } finally {
      setIsUploading(true); // Wait, this should be false
      setIsUploading(false);
    }
  };

  const handleIndexDocument = async () => {
    if (!filePath || !collectionName) {
      Alert.alert('Error', 'Please provide file path and knowledge base name');
      return;
    }

    setIndexResult('Indexing...');

    try {
      const result = await indexDocument('peng', filePath, collectionName, typeOfFile);
      setIndexResult(result);
      Alert.alert('Success', 'Document indexed successfully');
      loadDocuments();
      
      // Clear form
      setFilePath('');
      setCollectionName('');
    } catch (err) {
      setIndexResult(err instanceof Error ? err.message : 'Failed to index document');
      Alert.alert('Error', `Indexing failed: ${err}`);
    }
  };

  const renderDocumentItem = ({ item }: { item: RAGDocument }) => (
    <View style={styles.docCard}>
      <Text style={styles.docTitle}>{item.title || 'Untitled'}</Text>
      <Text style={styles.docInfo}>KB: {item.knowledge_base} | Type: {item.type}</Text>
      <Text style={styles.docPath} numberOfLines={1}>{item.path}</Text>
    </View>
  );

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.modalText}>RAG Documents</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formSection} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Add New Document</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>File Path / Name</Text>
              <View style={styles.uploadRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 10 }]}
                  value={filePath}
                  onChangeText={setFilePath}
                  placeholder="Select a file or enter path"
                />
                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={handlePickDocument}
                  disabled={isUploading}
                >
                  <Text style={styles.uploadButtonText}>
                    {isUploading ? '...' : '📎'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Knowledge Base</Text>
              <TextInput
                style={styles.input}
                value={collectionName}
                onChangeText={setCollectionName}
                placeholder="Knowledge base name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Extraction Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeButton, typeOfFile === 'standard' && styles.typeButtonActive]}
                  onPress={() => setTypeOfFile('standard')}
                >
                  <Text style={[styles.typeButtonText, typeOfFile === 'standard' && styles.typeButtonTextActive]}>Standard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, typeOfFile === 'handwriting' && styles.typeButtonActive]}
                  onPress={() => setTypeOfFile('handwriting')}
                >
                  <Text style={[styles.typeButtonText, typeOfFile === 'handwriting' && styles.typeButtonTextActive]}>Handwriting</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, (isLoading || isUploading) && styles.disabledButton]} 
              onPress={handleIndexDocument}
              disabled={isLoading || isUploading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>Index Document</Text>
              )}
            </TouchableOpacity>

            {indexResult ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultText}>{indexResult}</Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.listHeader}>
                <Text style={styles.sectionTitle}>Existing Documents</Text>
                <TouchableOpacity onPress={loadDocuments}>
                    <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity 
                  style={[styles.filterChip, selectedKnowledgeBase === '' && styles.filterChipActive]}
                  onPress={() => setSelectedKnowledgeBase('')}
                >
                  <Text style={[styles.filterChipText, selectedKnowledgeBase === '' && styles.filterChipTextActive]}>All KBs</Text>
                </TouchableOpacity>
                {knowledgeBases.map(kb => (
                  <TouchableOpacity 
                    key={kb}
                    style={[styles.filterChip, selectedKnowledgeBase === kb && styles.filterChipActive]}
                    onPress={() => setSelectedKnowledgeBase(kb)}
                  >
                    <Text style={[styles.filterChipText, selectedKnowledgeBase === kb && styles.filterChipTextActive]}>{kb}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {isLoading && documents.length === 0 ? (
                <ActivityIndicator size="small" color="#007AFF" />
            ) : (
                <View style={styles.docList}>
                    {filteredDocuments.map(doc => (
                        <View key={doc.id} style={styles.docCard}>
                             <Text style={styles.docTitle}>{doc.title || 'Untitled'}</Text>
                             <Text style={styles.docInfo}>KB: {doc.knowledge_base} | Type: {doc.type}</Text>
                             <Text style={styles.docPath} numberOfLines={1}>{doc.path}</Text>
                        </View>
                    ))}
                    {filteredDocuments.length === 0 && (
                        <Text style={styles.emptyText}>No documents found</Text>
                    )}
                </View>
            )}
            
            <View style={{ height: 40 }} />
          </ScrollView>
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
    marginBottom: Typography.spacing.md,
  },
  modalText: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    color: Colors.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: Typography.sizes.xl,
    color: Colors.textDim,
  },
  formSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    color: Colors.textMain,
    marginBottom: Typography.spacing.sm,
    letterSpacing: Typography.letterSpacing.tight,
  },
  inputGroup: {
    marginBottom: Typography.spacing.md,
  },
  label: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    color: Colors.primary,
    marginBottom: Typography.spacing['2xs'],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: Colors.bgDeep,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Typography.spacing.sm,
    fontSize: Typography.sizes.base,
    color: Colors.textMain,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadButton: {
    backgroundColor: Colors.bgDeep,
    padding: Typography.spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    fontSize: 20,
    color: Colors.textMain,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Typography.spacing.sm,
  },
  typeButton: {
    flex: 1,
    padding: Typography.spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgDeep,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    color: Colors.textDim,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.sm,
  },
  typeButtonTextActive: {
    color: Colors.primary,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    padding: Typography.spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Typography.spacing.sm,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.black,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  resultBox: {
    marginTop: Typography.spacing.md,
    padding: Typography.spacing.sm,
    backgroundColor: Colors.bgDeep,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  resultText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textDim,
    fontWeight: Typography.weights.medium,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Typography.spacing.xl,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Typography.spacing.sm,
  },
  refreshText: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
    fontSize: Typography.sizes.sm,
  },
  filterRow: {
    marginBottom: Typography.spacing.md,
  },
  filterChip: {
    paddingHorizontal: Typography.spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgDeep,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  docList: {
    gap: Typography.spacing.sm,
  },
  docCard: {
    backgroundColor: Colors.bgCard,
    padding: Typography.spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textMain,
    marginBottom: 4,
  },
  docInfo: {
    fontSize: Typography.sizes.xs,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
    marginBottom: 2,
  },
  docPath: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Typography.fonts.mono,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: Typography.spacing.lg,
    fontSize: Typography.sizes.base,
  },
});
