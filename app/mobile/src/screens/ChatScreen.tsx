import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppDispatch, RootState } from '@share/store';
import { fetchBaseModels } from '@share/store/slices/modelSlice';
import { fetchTools } from '@share/store/slices/toolSlice';
import {
  addUserMessage,
  sendMessage,
  setBaseModel,
  setError,
  setInput,
  setKnowledgeBase,
  setSelectedToolNames,
  submitMessageFeedback,
  setUploadedImages,
} from '@share/store/slices/chatSlice';
import { Message, UploadedImage } from '@share/types/ChatInterface.types';
import { useRAGApi } from '@share/hooks/RAGAPI';
import { UploadService } from '@share/services/uploadService';
import Markdown from 'react-native-markdown-display';

type SelectorType = 'baseModel' | 'knowledgeBase';

export default function ChatScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { getCollections } = useRAGApi();

  const user = useSelector((state: RootState) => state.auth.user);
  const messages = useSelector((state: RootState) => state.chat.messages);
  const input = useSelector((state: RootState) => state.chat.input);
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const baseModel = useSelector((state: RootState) => state.chat.baseModel);
  const knowledgeBase = useSelector((state: RootState) => state.chat.knowledgeBase);
  const selectedToolNames = useSelector((state: RootState) => state.chat.selectedToolNames);
  const uploadedImages = useSelector((state: RootState) => state.chat.uploadedImages);
  const error = useSelector((state: RootState) => state.chat.error);
  const availableBaseModels = useSelector((state: RootState) => state.models.availableBaseModels);
  const baseModelsLoading = useSelector((state: RootState) => state.models.loading);
  const availableTools = useSelector((state: RootState) => state.tools.availableTools);
  const toolsLoading = useSelector((state: RootState) => state.tools.loading);

  const flatListRef = useRef<FlatList>(null);
  const [collections, setCollections] = useState<string[]>(['default']);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectorType, setSelectorType] = useState<SelectorType>('baseModel');
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [isComposerCollapsed, setIsComposerCollapsed] = useState(false);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [foldedMessages, setFoldedMessages] = useState<Record<number, boolean>>({});
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    dispatch(fetchBaseModels());
    dispatch(fetchTools());
  }, [dispatch]);

  useEffect(() => {
    let mounted = true;
    getCollections()
      .then((data) => {
        if (!mounted) return;
        const normalized = ['default'].concat(Array.isArray(data) ? data : []);
        setCollections(normalized);
        if (!normalized.includes(knowledgeBase)) {
          dispatch(setKnowledgeBase(normalized[0]));
        }
      })
      .catch(() => {
        if (!mounted) return;
        setCollections(['default']);
      });

    return () => {
      mounted = false;
    };
  }, [dispatch, getCollections, knowledgeBase]);

  const handleSend = () => {
    if (!input.trim() && uploadedImages.length === 0) {
      return;
    }

    const userMessage = {
      role: 'user',
      content: input,
      type: 'user' as const,
      images: uploadedImages.filter((item) => item.contentType.startsWith('image/')).map((item) => item.preview),
    };

    dispatch(addUserMessage(userMessage));

    const operator = baseModel.includes('/') ? baseModel.split('/')[0] : 'openai';
    const request = {
      user_name: user || 'default_user',
      message: input,
      knowledge_base: knowledgeBase,
      image: uploadedImages.map((item) => item.path),
      config: {
        operator,
        base_model: baseModel,
        tools_name: selectedToolNames,
        short_term_memory: [],
      },
    };

    dispatch(sendMessage(request));
    setIsComposerCollapsed(true);
  };

  const addUploadedAsset = async (base64Data: string, mimeType: string, fileName: string) => {
    setIsUploading(true);
    try {
      const [uploadPath, success] = await UploadService.uploadFile(base64Data, mimeType, fileName);
      if (!success) {
        dispatch(setError('File upload failed. Please try again.'));
        return;
      }

      const newItem: UploadedImage = {
        path: uploadPath,
        preview: mimeType.startsWith('image/') ? base64Data : '',
        fileName,
        contentType: mimeType,
      };

      dispatch(setUploadedImages([...uploadedImages, newItem]));
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : 'File upload failed.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickImageFromLibrary = async () => {
    setAttachmentMenuVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      dispatch(setError('Permission to access photo library is required.'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.9,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const fileName = asset.fileName || `image-${Date.now()}.jpg`;
    const base64Data = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : '';

    if (!base64Data) {
      dispatch(setError('Unable to read image data from selected file.'));
      return;
    }

    await addUploadedAsset(base64Data, mimeType, fileName);
  };

  const handleTakePhoto = async () => {
    setAttachmentMenuVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      dispatch(setError('Permission to access camera is required.'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.9,
      mediaTypes: ['images'],
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const fileName = asset.fileName || `photo-${Date.now()}.jpg`;
    const base64Data = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : '';

    if (!base64Data) {
      dispatch(setError('Unable to read photo data from camera output.'));
      return;
    }

    await addUploadedAsset(base64Data, mimeType, fileName);
  };

  const handleRemoveUpload = (index: number) => {
    dispatch(setUploadedImages(uploadedImages.filter((_, i) => i !== index)));
  };

  const handleToggleTool = (toolName: string) => {
    if (selectedToolNames.includes(toolName)) {
      dispatch(setSelectedToolNames(selectedToolNames.filter((name) => name !== toolName)));
      return;
    }
    dispatch(setSelectedToolNames([...selectedToolNames, toolName]));
  };

  const selectorTitle = selectorType === 'baseModel' ? 'Select Base Model' : 'Select Knowledge Base';

  const selectorOptions = useMemo(
    () =>
      selectorType === 'baseModel'
        ? availableBaseModels.map((item) => item.model_name)
        : collections,
    [availableBaseModels, collections, selectorType]
  );

  const selectedValue = selectorType === 'baseModel' ? baseModel : knowledgeBase;

  const handleSelectOption = (value: string) => {
    if (selectorType === 'baseModel') {
      dispatch(setBaseModel(value));
    } else {
      dispatch(setKnowledgeBase(value));
    }
    setSelectorVisible(false);
  };

  const handleFeedback = (messageId: string, chatId: number, feedback: 'upvote' | 'downvote') => {
    if (!user) return;
    dispatch(submitMessageFeedback({
      messageId,
      chatId,
      userName: user,
      feedback
    }));
  };

  const isFoldableMessage = (message: Message) => {
    return message.type === 'reasoning_summary' || message.type === 'tool_calls' || message.type === 'tool_output';
  };

  const getFoldLabel = (type?: string) => {
    if (type === 'tool_calls') return 'Tool Call';
    if (type === 'tool_output') return 'Tool Output';
    if (type === 'reasoning_summary') return 'Reasoning Summary';
    return 'System Message';
  };

  const toggleFolded = (index: number, currentState: boolean) => {
    setFoldedMessages((prev) => ({
      ...prev,
      [index]: !currentState,
    }));
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isFoldable = isFoldableMessage(item);
    const isFolded = foldedMessages[index] ?? item.folded ?? false;

    return (
    <View style={[
      styles.messageWrapper,
      item.role === 'human' || item.role === 'user' ? styles.messageWrapperUser : styles.messageWrapperAssistant
    ]}>
      <View style={[
        styles.messageBubble,
        item.role === 'human' || item.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAssistant
      ]}>
        {item.role === 'ai' || item.role === 'assistant' ? (
          <>
            {isFoldable && (
              <Pressable style={styles.foldHeader} onPress={() => toggleFolded(index, isFolded)}>
                <MaterialCommunityIcons
                  name={isFolded ? 'chevron-right' : 'chevron-down'}
                  size={16}
                  color="#D1D5DB"
                />
                <Text style={styles.foldHeaderText}>{getFoldLabel(item.type)}</Text>
              </Pressable>
            )}
            {!isFolded && (
              <>
                <Markdown style={markdownStyles}>
                  {item.content}
                </Markdown>
                {item.chatId && item.messageId && item.type === 'output_text' && (
                  <View style={styles.feedbackContainer}>
                    <TouchableOpacity
                      onPress={() => handleFeedback(item.messageId!, item.chatId!, 'upvote')}
                      disabled={item.feedbackUpdating}
                      style={styles.feedbackButton}
                    >
                      <MaterialCommunityIcons
                        name={item.feedback === 'upvote' ? 'thumb-up' : 'thumb-up-outline'}
                        size={16}
                        color={item.feedback === 'upvote' ? '#10B981' : '#9CA3AF'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleFeedback(item.messageId!, item.chatId!, 'downvote')}
                      disabled={item.feedbackUpdating}
                      style={styles.feedbackButton}
                    >
                      <MaterialCommunityIcons
                        name={item.feedback === 'downvote' ? 'thumb-down' : 'thumb-down-outline'}
                        size={16}
                        color={item.feedback === 'downvote' ? '#EF4444' : '#9CA3AF'}
                      />
                    </TouchableOpacity>
                    {item.feedbackUpdating && <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 5 }} />}
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <Text style={styles.userText}>{item.content}</Text>
        )}
      </View>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>

      <View style={styles.configPanel}>
        <Pressable style={styles.configToggleButton} onPress={() => setIsConfigExpanded((prev) => !prev)}>
          <Text style={styles.configToggleText}>Chat Configuration</Text>
          <MaterialCommunityIcons name={isConfigExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#D1D5DB" />
        </Pressable>

        {isConfigExpanded && (
          <>
            <View style={styles.configRow}>
              <Pressable
                style={styles.selectorButton}
                onPress={() => {
                  setSelectorType('baseModel');
                  setSelectorVisible(true);
                }}
              >
                <Text style={styles.selectorLabel}>Base Model</Text>
                <Text style={styles.selectorValue} numberOfLines={1}>{baseModel}</Text>
              </Pressable>

              <Pressable
                style={styles.selectorButton}
                onPress={() => {
                  setSelectorType('knowledgeBase');
                  setSelectorVisible(true);
                }}
              >
                <Text style={styles.selectorLabel}>Knowledge Base</Text>
                <Text style={styles.selectorValue} numberOfLines={1}>{knowledgeBase}</Text>
              </Pressable>
            </View>

            <View style={styles.toolRowHeader}>
              <Text style={styles.toolRowTitle}>Tools</Text>
              {toolsLoading ? <ActivityIndicator size="small" color="#10B981" /> : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolChipWrap}>
              {availableTools.map((tool) => {
                const selected = selectedToolNames.includes(tool.name);
                return (
                  <Pressable
                    key={tool.id || tool.name}
                    style={[styles.toolChip, selected && styles.toolChipSelected]}
                    onPress={() => handleToggleTool(tool.name)}
                  >
                    <Text style={[styles.toolChipText, selected && styles.toolChipTextSelected]}>{tool.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FCA5A5" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {uploadedImages.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentPreviewWrap}>
          {uploadedImages.map((file, index) => (
            <View key={`${file.path}-${index}`} style={styles.attachmentItem}>
              {file.contentType.startsWith('image/') ? (
                <Image source={{ uri: file.preview }} style={styles.attachmentImage} />
              ) : (
                <View style={styles.fileBadge}>
                  <MaterialCommunityIcons name="file-pdf-box" size={24} color="#F97316" />
                  <Text style={styles.fileBadgeText} numberOfLines={1}>{file.fileName}</Text>
                </View>
              )}
              <Pressable style={styles.removeAttachmentButton} onPress={() => handleRemoveUpload(index)}>
                <Text style={styles.removeAttachmentText}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        {isComposerCollapsed ? (
          <Pressable style={styles.composerCollapsedBar} onPress={() => setIsComposerCollapsed(false)}>
            <MaterialCommunityIcons name="message-text-outline" size={18} color="#9CA3AF" />
            <Text style={styles.composerCollapsedText}>
              {uploadedImages.length > 0 ? `Continue message (${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''})` : 'Tap to compose'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.inputRow}>
            <Pressable
              style={styles.actionIconButton}
              onPress={() => setAttachmentMenuVisible(true)}
              disabled={isUploading || isLoading}
            >
              <MaterialCommunityIcons name="camera-plus-outline" size={20} color="#D1D5DB" />
            </Pressable>

            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#9CA3AF"
              value={input}
              onFocus={() => setIsComposerCollapsed(false)}
              onChangeText={(text) => dispatch(setInput(text))}
              multiline
            />

            <TouchableOpacity
              style={[styles.sendButton, !input.trim() && uploadedImages.length === 0 && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={isLoading || isUploading || (!input.trim() && uploadedImages.length === 0)}
            >
              {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.sendButtonText}>Send</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal animationType="slide" transparent visible={selectorVisible} onRequestClose={() => setSelectorVisible(false)}>
        <Pressable style={styles.selectorOverlay} onPress={() => setSelectorVisible(false)}>
          <View style={styles.selectorSheet}>
            <Text style={styles.selectorSheetTitle}>{selectorTitle}</Text>
            <ScrollView>
              {selectorOptions.map((value) => {
                const selected = selectedValue === value;
                return (
                  <Pressable key={value} style={[styles.selectorOption, selected && styles.selectorOptionSelected]} onPress={() => handleSelectOption(value)}>
                    <Text style={[styles.selectorOptionText, selected && styles.selectorOptionTextSelected]}>{value}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={attachmentMenuVisible} onRequestClose={() => setAttachmentMenuVisible(false)}>
        <Pressable style={styles.selectorOverlay} onPress={() => setAttachmentMenuVisible(false)}>
          <View style={styles.attachmentSheet}>
            <Pressable style={styles.attachmentSheetAction} onPress={handlePickImageFromLibrary}>
              <MaterialCommunityIcons name="image-outline" size={20} color="#D1FAE5" />
              <Text style={styles.attachmentSheetActionText}>Upload from gallery</Text>
            </Pressable>
            <Pressable style={styles.attachmentSheetAction} onPress={handleTakePhoto}>
              <MaterialCommunityIcons name="camera-outline" size={20} color="#D1FAE5" />
              <Text style={styles.attachmentSheetActionText}>Take a photo</Text>
            </Pressable>
            <Pressable style={styles.attachmentSheetCancel} onPress={() => setAttachmentMenuVisible(false)}>
              <Text style={styles.attachmentSheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {(isUploading || baseModelsLoading) && (
        <View style={styles.uploadHint}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.uploadHintText}>{isUploading ? 'Uploading file...' : 'Loading base models...'}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#212121',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#047857',
    borderBottomWidth: 1,
    borderBottomColor: '#065F46',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  listContent: {
    padding: 15,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperAssistant: {
    justifyContent: 'flex-start',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleUser: {
    backgroundColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderBottomLeftRadius: 0,
    borderWidth: 0,
    maxWidth: '100%',
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  userText: {
    color: '#ffffff',
    fontSize: 16,
  },
  inputContainer: {
    padding: 10,
    backgroundColor: '#2F3237',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    backgroundColor: '#212121',
    color: '#F9FAFB',
    borderRadius: 14,
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 110,
    minHeight: 40,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    height: 42,
    minWidth: 64,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#4B5563',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  configPanel: {
    backgroundColor: '#212121',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomColor: '#374151',
    borderBottomWidth: 1,
    gap: 8,
  },
  configToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2F3237',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  configToggleText: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },
  configRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorButton: {
    flex: 1,
    backgroundColor: '#2F3237',
    borderColor: '#374151',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectorLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  selectorValue: {
    color: '#F9FAFB',
    marginTop: 4,
    fontSize: 13,
  },
  toolRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolRowTitle: {
    color: '#D1D5DB',
    fontWeight: '600',
    fontSize: 13,
  },
  toolChipWrap: {
    gap: 8,
    paddingBottom: 2,
  },
  toolChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#2F3237',
  },
  toolChipSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  toolChipText: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  toolChipTextSelected: {
    color: '#D1FAE5',
  },
  errorBar: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.36)',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#FCA5A5',
    flex: 1,
    fontSize: 12,
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  selectorSheet: {
    maxHeight: '70%',
    backgroundColor: '#212121',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
    borderColor: '#374151',
    borderWidth: 1,
  },
  selectorSheetTitle: {
    color: '#F9FAFB',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  selectorOption: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  selectorOptionSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  selectorOptionText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  selectorOptionTextSelected: {
    color: '#D1FAE5',
    fontWeight: '600',
  },
  attachmentPreviewWrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
  },
  attachmentItem: {
    width: 82,
    height: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4B5563',
    overflow: 'hidden',
    backgroundColor: '#2F3237',
    position: 'relative',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  fileBadge: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  fileBadgeText: {
    color: '#D1D5DB',
    fontSize: 10,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderBottomLeftRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttachmentText: {
    color: '#FFFFFF',
    lineHeight: 18,
    fontSize: 16,
  },
  actionIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#212121',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadHint: {
    position: 'absolute',
    top: 60,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  uploadHintText: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 8,
    gap: 15,
  },
  feedbackButton: {
    padding: 4,
  },
  foldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  foldHeaderText: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },
  composerCollapsedBar: {
    backgroundColor: '#212121',
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerCollapsedText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  attachmentSheet: {
    backgroundColor: '#212121',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderColor: '#374151',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
  },
  attachmentSheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#2F3237',
    borderWidth: 1,
    borderColor: '#374151',
  },
  attachmentSheetActionText: {
    color: '#F3F4F6',
    fontSize: 15,
    fontWeight: '500',
  },
  attachmentSheetCancel: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 10,
  },
  attachmentSheetCancelText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});

const markdownStyles = {
  body: {
    color: '#E5E7EB',
    fontSize: 16,
  },
  code_inline: {
    backgroundColor: '#111827',
    padding: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  fence: {
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
};