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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    height: '95%',
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
  formSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadButton: {
    backgroundColor: '#e9ecef',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    width: 50,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 18,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    color: '#495057',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  resultBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  resultText: {
    fontSize: 14,
    color: '#495057',
  },
  divider: {
    height: 1,
    backgroundColor: '#dee2e6',
    marginVertical: 25,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  refreshText: {
    color: '#007AFF',
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
  },
  filterChipTextActive: {
    color: 'white',
  },
  docList: {
    gap: 12,
  },
  docCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  docInfo: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  docPath: {
    fontSize: 11,
    color: '#adb5bd',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 10,
  },
});
