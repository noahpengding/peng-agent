import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Animated, { 
  FadeIn, 
  FadeOut, 
  FadeInDown, 
  FadeInUp,
  SlideInRight,
  LinearTransition,
  ZoomIn
} from 'react-native-reanimated';
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
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';

type SelectorType = 'baseModel' | 'knowledgeBase';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const MessageItem = React.memo(({ 
  item, 
  index, 
  isFolded, 
  onToggleFold, 
  onFeedback 
}: { 
  item: Message; 
  index: number; 
  isFolded: boolean; 
  onToggleFold: (index: number, current: boolean) => void;
  onFeedback: (mid: string, cid: number, f: 'upvote' | 'downvote') => void;
}) => {
  const isFoldable = item.type === 'reasoning_summary' || item.type === 'tool_calls' || item.type === 'tool_output';
  const isUser = item.role === 'human' || item.role === 'user';

  const getFoldLabel = (type?: string) => {
    if (type === 'tool_calls') return 'Tool Call';
    if (type === 'tool_output') return 'Tool Output';
    if (type === 'reasoning_summary') return 'Reasoning Summary';
    return 'System Message';
  };

  return (
    <Animated.View 
      entering={isUser ? SlideInRight : FadeInUp}
      layout={LinearTransition}
      style={[
        styles.messageWrapper,
        isUser ? styles.messageWrapperUser : styles.messageWrapperAssistant
      ]}
    >
      <View style={[
        styles.messageBubble,
        isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant
      ]}>
        {!isUser ? (
          <>
            {isFoldable && (
              <Pressable style={styles.foldHeader} onPress={() => onToggleFold(index, isFolded)}>
                <MaterialCommunityIcons
                  name={isFolded ? 'chevron-right' : 'chevron-down'}
                  size={16}
                  color="#D1D5DB"
                />
                <Text style={styles.foldHeaderText}>{getFoldLabel(item.type)}</Text>
              </Pressable>
            )}
            {!isFolded && (
              <Animated.View entering={FadeIn} layout={LinearTransition}>
                <Markdown style={markdownStyles}>
                  {item.content}
                </Markdown>
                {item.chatId && item.messageId && item.type === 'output_text' && (
                  <View style={styles.feedbackContainer}>
                    <TouchableOpacity
                      onPress={() => onFeedback(item.messageId!, item.chatId!, 'upvote')}
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
                      onPress={() => onFeedback(item.messageId!, item.chatId!, 'downvote')}
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
              </Animated.View>
            )}
          </>
        ) : (
          <Text style={styles.userText}>{item.content}</Text>
        )}
      </View>
    </Animated.View>
  );
});

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

  const handleFeedback = useCallback((messageId: string, chatId: number, feedback: 'upvote' | 'downvote') => {
    if (!user) return;
    dispatch(submitMessageFeedback({
      messageId,
      chatId,
      userName: user,
      feedback
    }));
  }, [dispatch, user]);

  const toggleFolded = useCallback((index: number, currentState: boolean) => {
    setFoldedMessages((prev) => ({
      ...prev,
      [index]: !currentState,
    }));
  }, []);

  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => (
    <MessageItem 
      item={item} 
      index={index} 
      isFolded={foldedMessages[index] ?? item.folded ?? false} 
      onToggleFold={toggleFolded}
      onFeedback={handleFeedback}
    />
  ), [foldedMessages, toggleFolded, handleFeedback]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View layout={LinearTransition} style={styles.configPanel}>
        <Pressable style={styles.configToggleButton} onPress={() => setIsConfigExpanded((prev) => !prev)}>
          <Text style={styles.configToggleText}>Chat Configuration</Text>
          <MaterialCommunityIcons name={isConfigExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#D1D5DB" />
        </Pressable>

        {isConfigExpanded && (
          <Animated.View entering={FadeInUp} exiting={FadeOut} style={{ gap: 8 }}>
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
          </Animated.View>
        )}
      </Animated.View>

      {error ? (
        <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.errorBar}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FCA5A5" />
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      ) : null}

      <AnimatedFlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        itemLayoutAnimation={LinearTransition}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {uploadedImages.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentPreviewWrap}>
          {uploadedImages.map((file, index) => (
            <Animated.View 
              key={`${file.path}-${index}`} 
              entering={ZoomIn} 
              exiting={FadeOut}
              layout={LinearTransition}
              style={styles.attachmentItem}
            >
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
            </Animated.View>
          ))}
        </ScrollView>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <Animated.View layout={LinearTransition}>
          {isComposerCollapsed ? (
            <Pressable style={styles.composerCollapsedBar} onPress={() => setIsComposerCollapsed(false)}>
              <MaterialCommunityIcons name="message-text-outline" size={18} color="#9CA3AF" />
              <Text style={styles.composerCollapsedText}>
                {uploadedImages.length > 0 ? `Continue message (${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''})` : 'Tap to compose'}
              </Text>
            </Pressable>
          ) : (
            <Animated.View entering={FadeInUp} style={styles.inputRow}>
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
            </Animated.View>
          )}
        </Animated.View>
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
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.uploadHint}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.uploadHintText}>{isUploading ? 'Uploading file...' : 'Loading base models...'}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  listContent: {
    padding: Typography.spacing.sm,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: Typography.spacing.sm,
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperAssistant: {
    justifyContent: 'flex-start',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: Typography.spacing.xs,
    borderRadius: 18,
  },
  messageBubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: Colors.bgCard,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: '100%',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  userText: {
    color: Colors.white,
    fontSize: Typography.sizes.base,
    lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
    fontWeight: Typography.weights.medium,
  },
  inputContainer: {
    padding: Typography.spacing.xs,
    backgroundColor: Colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Typography.spacing['2xs'],
  },
  input: {
    backgroundColor: Colors.bgDeep,
    color: Colors.textMain,
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: Typography.spacing.xs,
    paddingTop: Typography.spacing.xs,
    paddingBottom: Typography.spacing.xs,
    maxHeight: 120,
    minHeight: 48,
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fonts.sans,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 48,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  sendButtonText: {
    color: Colors.white,
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.sm,
    textTransform: 'uppercase',
  },
  configPanel: {
    backgroundColor: Colors.bgSurface,
    paddingHorizontal: Typography.spacing.xs,
    paddingVertical: Typography.spacing.xs,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    gap: Typography.spacing.xs,
  },
  configToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgDeep,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Typography.spacing.xs,
    paddingVertical: Typography.spacing.xs,
  },
  configToggleText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.extraBold,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
  },
  configRow: {
    flexDirection: 'row',
    gap: 10,
  },
  selectorButton: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Typography.spacing['3xs'],
  },
  selectorValue: {
    color: Colors.textMain,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  toolRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Typography.spacing['3xs'],
  },
  toolRowTitle: {
    color: Colors.textDim,
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolChipWrap: {
    gap: Typography.spacing['2xs'],
    paddingBottom: 4,
  },
  toolChip: {
    paddingVertical: Typography.spacing['2xs'],
    paddingHorizontal: Typography.spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgDeep,
  },
  toolChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  toolChipText: {
    color: Colors.textDim,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  toolChipTextSelected: {
    color: Colors.primary,
  },
  errorBar: {
    margin: Typography.spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    paddingHorizontal: Typography.spacing.xs,
    paddingVertical: Typography.spacing['2xs'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: Colors.error,
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  selectorSheet: {
    maxHeight: '75%',
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  selectorSheetTitle: {
    color: Colors.primary,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.black,
    marginBottom: Typography.spacing.sm,
    letterSpacing: Typography.letterSpacing.tight,
  },
  selectorOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.bgDeep,
  },
  selectorOptionSelected: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  selectorOptionText: {
    color: Colors.textDim,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
  },
  selectorOptionTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.weights.extraBold,
  },
  attachmentPreviewWrap: {
    paddingHorizontal: Typography.spacing.xs,
    paddingVertical: Typography.spacing.xs,
    gap: Typography.spacing['2xs'],
  },
  attachmentItem: {
    width: 88,
    height: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
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
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomLeftRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttachmentText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadHint: {
    position: 'absolute',
    top: 70,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  uploadHintText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Typography.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Typography.spacing['2xs'],
    gap: 20,
  },
  feedbackButton: {
    padding: 6,
  },
  foldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Typography.spacing['2xs'],
    marginBottom: Typography.spacing['2xs'],
    backgroundColor: Colors.bgDeep,
    padding: Typography.spacing['2xs'],
    borderRadius: 8,
  },
  foldHeaderText: {
    color: Colors.primary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  composerCollapsedBar: {
    backgroundColor: Colors.bgDeep,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerCollapsedText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  attachmentSheet: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  attachmentSheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Colors.bgDeep,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  attachmentSheetActionText: {
    color: Colors.textMain,
    fontSize: 16,
    fontWeight: '600',
  },
  attachmentSheetCancel: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  attachmentSheetCancelText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '700',
  },
});

const markdownStyles = {
  body: {
    color: Colors.textMain,
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fonts.sans,
    lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
  },
  code_inline: {
    backgroundColor: Colors.bgDeep,
    padding: 2,
    borderRadius: 4,
    fontFamily: Typography.fonts.mono,
    fontSize: Typography.sizes.sm,
  },
  fence: {
    backgroundColor: Colors.bgDeep,
    padding: 10,
    borderRadius: 8,
    fontFamily: Typography.fonts.mono,
    fontSize: Typography.sizes.sm,
  },
};