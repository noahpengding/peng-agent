import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  useWindowDimensions,
  type ImageLoadEventData,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppDispatch, RootState } from '@/store';
import { fetchBaseModels } from '@/store/slices/modelSlice';
import { fetchTools } from '@/store/slices/toolSlice';
import {
  addUserMessage,
  prepareLastTurnRetry,
  sendMessage,
  setBaseModel,
  setError,
  setInput,
  setKnowledgeBase,
  setSelectedToolNames,
  setTempChat,
  submitMessageFeedback,
  setUploadedImages,
} from '@/store/slices/chatSlice';
import MarkdownMathBlock from '@/components/MarkdownMathBlock';
import { Message, UploadedImage } from '@/types/ChatInterface.types';
import { useRAGApi } from '@/hooks/RAGAPI';
import { UploadService } from '@/services/uploadService';
import { markdownItBracketMath } from '@/utils/markdownMath';
import Markdown, { 
  ASTNode, 
  RenderRules,
  openUrl,
} from 'react-native-markdown-display';
import MarkdownIt from 'markdown-it';
import markdownItKatex from 'markdown-it-katex';
import Katex from 'react-native-katex';
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';

const md = new MarkdownIt({
  typographer: true,
})
  .use(markdownItKatex)
  .use(markdownItBracketMath);

const MemoizedMarkdown = React.memo(Markdown);

const AUTO_SCROLL_THRESHOLD_PX = 120;
const FLAT_LIST_INITIAL_RENDER_COUNT = 12;
const FLAT_LIST_BATCH_RENDER_COUNT = 8;
const FLAT_LIST_WINDOW_SIZE = 5;
const MAX_MESSAGE_IMAGE_WIDTH = 360;
const MAX_MESSAGE_IMAGE_HEIGHT = 520;
const FALLBACK_MESSAGE_IMAGE_HEIGHT = 260;

const getMessageKey = (item: Message, index: number): string =>
  item.clientKey || `${item.messageId || item.type || item.role}-${index}`;

const remoteMessageImageStyle = {
  width: '100%',
  height: '100%',
} as const;

type ImageSize = {
  width: number;
  height: number;
};

type MarkdownStyles = Record<string, unknown>;
type MarkdownInheritedStyle = StyleProp<TextStyle>;

const getContainedImageSize = (imageSize: ImageSize | null, maxWidth: number): ImageSize => {
  if (!imageSize?.width || !imageSize.height) {
    return {
      width: maxWidth,
      height: FALLBACK_MESSAGE_IMAGE_HEIGHT,
    };
  }

  const scale = Math.min(1, maxWidth / imageSize.width, MAX_MESSAGE_IMAGE_HEIGHT / imageSize.height);

  return {
    width: Math.round(imageSize.width * scale),
    height: Math.round(imageSize.height * scale),
  };
};

const trimMarkdownCodeContent = (content: string): string =>
  content.endsWith('\n') ? content.substring(0, content.length - 1) : content;

const markdownTextStyle = (styles: MarkdownStyles, key: string): StyleProp<TextStyle> =>
  styles[key] as StyleProp<TextStyle>;

const markdownViewStyle = (styles: MarkdownStyles, key: string): StyleProp<ViewStyle> =>
  styles[key] as StyleProp<ViewStyle>;

const markdownFlattenedTextStyle = (styles: MarkdownStyles, key: string): TextStyle =>
  StyleSheet.flatten(markdownTextStyle(styles, key)) ?? {};

const markdownMathColor = (styles: MarkdownStyles): string => {
  const color = markdownFlattenedTextStyle(styles, 'math').color;
  return typeof color === 'string' ? color : Colors.textMain;
};

const markdownMathFontSize = (styles: MarkdownStyles): number => {
  const fontSize = markdownFlattenedTextStyle(styles, 'math').fontSize;
  return typeof fontSize === 'number' ? fontSize : Typography.sizes.base;
};

const handleMarkdownLinkPress = (url: string, onLinkPress?: (url: string) => boolean) => {
  if (!url) return;
  if (onLinkPress) {
    if (onLinkPress(url)) {
      openUrl(url);
    }
    return;
  }
  openUrl(url);
};

const markdownRules: RenderRules = {
  strong: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: MarkdownStyles) => (
    <Text key={node.key} selectable style={markdownTextStyle(styles, 'strong')}>
      {children}
    </Text>
  ),
  em: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: MarkdownStyles) => (
    <Text key={node.key} selectable style={markdownTextStyle(styles, 'em')}>
      {children}
    </Text>
  ),
  s: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: MarkdownStyles) => (
    <Text key={node.key} selectable style={markdownTextStyle(styles, 's')}>
      {children}
    </Text>
  ),
  code_inline: (
    node: ASTNode,
    children: React.ReactNode[],
    parent: ASTNode[],
    styles: MarkdownStyles,
    inheritedStyles: MarkdownInheritedStyle = {},
  ) => (
    <Text key={node.key} selectable style={[inheritedStyles, markdownTextStyle(styles, 'code_inline')]}>
      {node.content}
    </Text>
  ),
  code_block: (
    node: ASTNode,
    children: React.ReactNode[],
    parent: ASTNode[],
    styles: MarkdownStyles,
    inheritedStyles: MarkdownInheritedStyle = {},
  ) => (
    <Text key={node.key} selectable style={[inheritedStyles, markdownTextStyle(styles, 'code_block')]}>
      {trimMarkdownCodeContent(node.content)}
    </Text>
  ),
  fence: (
    node: ASTNode,
    children: React.ReactNode[],
    parent: ASTNode[],
    styles: MarkdownStyles,
    inheritedStyles: MarkdownInheritedStyle = {},
  ) => (
    <Text key={node.key} selectable style={[inheritedStyles, markdownTextStyle(styles, 'fence')]}>
      {trimMarkdownCodeContent(node.content)}
    </Text>
  ),
  link: (
    node: ASTNode,
    children: React.ReactNode[],
    parent: ASTNode[],
    styles: MarkdownStyles,
    onLinkPress?: (url: string) => boolean,
  ) => (
    <Text
      key={node.key}
      selectable
      style={markdownTextStyle(styles, 'link')}
      onPress={() => handleMarkdownLinkPress(node.attributes.href, onLinkPress)}
    >
      {children}
    </Text>
  ),
  text: (
    node: ASTNode,
    children: React.ReactNode[],
    parent: ASTNode[],
    styles: MarkdownStyles,
    inheritedStyles: MarkdownInheritedStyle = {},
  ) => (
    <Text key={node.key} selectable style={[inheritedStyles, markdownTextStyle(styles, 'text')]}>
      {node.content}
    </Text>
  ),
  textgroup: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: MarkdownStyles) => (
    <Text key={node.key} selectable style={markdownTextStyle(styles, 'textgroup')}>
      {children}
    </Text>
  ),
  hardbreak: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: MarkdownStyles) => (
    <Text key={node.key} selectable style={markdownTextStyle(styles, 'hardbreak')}>
      {'\n'}
    </Text>
  ),
  softbreak: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: MarkdownStyles) => (
    <Text key={node.key} selectable style={markdownTextStyle(styles, 'softbreak')}>
      {'\n'}
    </Text>
  ),
  inline: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: MarkdownStyles) => (
    <Text key={node.key} selectable style={markdownTextStyle(styles, 'inline')}>
      {children}
    </Text>
  ),
  span: (node: ASTNode, children: React.ReactNode[], parent: ASTNode[], styles: MarkdownStyles) => (
    <Text key={node.key} selectable style={markdownTextStyle(styles, 'span')}>
      {children}
    </Text>
  ),
  math_inline: (
    node: ASTNode,
    children: React.ReactNode[],
    parent: ASTNode[],
    styles: MarkdownStyles,
  ) => (
    <Katex
      key={node.key}
      expression={node.content}
      style={{
        ...markdownFlattenedTextStyle(styles, 'math'),
        backgroundColor: 'transparent',
      }}
    />
  ),
  math_block: (
    node: ASTNode,
    children: React.ReactNode[],
    parent: ASTNode[],
    styles: MarkdownStyles,
  ) => (
    <View key={node.key} style={markdownViewStyle(styles, 'mathBlock')}>
      <MarkdownMathBlock
        expression={node.content}
        color={markdownMathColor(styles)}
        fontSize={markdownMathFontSize(styles)}
      />
    </View>
  ),
};

type SelectorType = 'baseModel' | 'knowledgeBase';

const RemoteMessageImage = React.memo(({ uri }: { uri: string }) => {
  const [hasLoadError, setHasLoadError] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const maxImageWidth = Math.max(
    120,
    Math.min(MAX_MESSAGE_IMAGE_WIDTH, windowWidth - Typography.spacing.md * 2),
  );
  const displaySize = getContainedImageSize(imageSize, maxImageWidth);

  useEffect(() => {
    let mounted = true;

    Image.getSize(
      uri,
      (width, height) => {
        if (!mounted) return;
        setImageSize({ width, height });
      },
      () => undefined,
    );

    return () => {
      mounted = false;
    };
  }, [uri]);

  const handleLoad = useCallback((event: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = event.nativeEvent.source;
    if (!width || !height) return;
    setImageSize({ width, height });
  }, []);

  if (hasLoadError) {
    return (
      <View style={styles.messageImageFallback}>
        <MaterialCommunityIcons name="image-broken-variant" size={22} color={Colors.error} />
        <Text style={styles.messageImageFallbackTitle}>Image failed to load.</Text>
        <Text selectable numberOfLines={2} style={styles.messageImageFallbackUrl}>
          {uri}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.messageImageFrame, displaySize]}>
      <Image
        source={{ uri }}
        style={remoteMessageImageStyle}
        resizeMode="contain"
        onLoad={handleLoad}
        onError={() => setHasLoadError(true)}
      />
    </View>
  );
});

RemoteMessageImage.displayName = 'RemoteMessageImage';

const MessageImages = React.memo(({ images }: { images?: string[] }) => {
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <View style={styles.messageImagesContainer}>
      {images.map((uri, index) => (
        <RemoteMessageImage key={`${uri}-${index}`} uri={uri} />
      ))}
    </View>
  );
});

MessageImages.displayName = 'MessageImages';

const MessageItem = React.memo(({ 
  item, 
  messageKey,
  isFolded, 
  onToggleFold, 
  canRetry,
  onRetry,
  onFeedback
}: { 
  item: Message; 
  messageKey: string;
  isFolded: boolean; 
  onToggleFold: (messageKey: string, current: boolean) => void;
  canRetry: boolean;
  onRetry: () => void;
  onFeedback: (mid: string, cid: number, f: 'upvote' | 'downvote') => void;
}) => {
  const isFoldable = item.type === 'reasoning_summary' || item.type === 'tool_calls' || item.type === 'tool_output';
  const isUser = item.role === 'human' || item.role === 'user';
  const canShowFeedback = !!item.chatId && !!item.messageId && item.type === 'output_text';

  const getFoldLabel = (type?: string) => {
    if (type === 'tool_calls') return 'Tool Call';
    if (type === 'tool_output') return 'Tool Output';
    if (type === 'reasoning_summary') return 'Reasoning Summary';
    return 'System Message';
  };

  return (
    <View 
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
              <Pressable style={styles.foldHeader} onPress={() => onToggleFold(messageKey, isFolded)}>
                <MaterialCommunityIcons
                  name={isFolded ? 'chevron-right' : 'chevron-down'}
                  size={16}
                  color="#D1D5DB"
                />
                <Text style={styles.foldHeaderText}>{getFoldLabel(item.type)}</Text>
              </Pressable>
            )}
            {!isFolded && (
              <View
                accessibilityRole={item.isError ? 'alert' : undefined}
                accessibilityLiveRegion={item.isError ? 'assertive' : undefined}
              >
                <MessageImages images={item.images} />
                {item.content ? (
                  <MemoizedMarkdown
                    style={markdownStyles}
                    markdownit={md}
                    rules={markdownRules}
                  >
                    {item.content}
                  </MemoizedMarkdown>
                ) : null}
                {(canShowFeedback || canRetry) && (
                  <View style={styles.feedbackContainer}>
                    {canRetry && (
                      <TouchableOpacity
                        onPress={onRetry}
                        style={styles.feedbackButton}
                        accessibilityRole="button"
                        accessibilityLabel="Retry last response"
                      >
                        <MaterialCommunityIcons
                          name="refresh"
                          size={17}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    )}
                    {canShowFeedback && (
                      <>
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
                      </>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            <MessageImages images={item.images} />
            {item.content ? (
              <MemoizedMarkdown
                style={userMarkdownStyles}
                markdownit={md}
                rules={markdownRules}
              >
                {item.content}
              </MemoizedMarkdown>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  const prevItem = prevProps.item;
  const nextItem = nextProps.item;

  const prevImages = prevItem.images || [];
  const nextImages = nextItem.images || [];
  const imagesAreEqual =
    prevImages.length === nextImages.length &&
    prevImages.every((image, index) => image === nextImages[index]);

  return (
    prevProps.messageKey === nextProps.messageKey &&
    prevProps.isFolded === nextProps.isFolded &&
    prevProps.onToggleFold === nextProps.onToggleFold &&
    prevProps.canRetry === nextProps.canRetry &&
    prevProps.onRetry === nextProps.onRetry &&
    prevProps.onFeedback === nextProps.onFeedback &&
    prevItem.content === nextItem.content &&
    prevItem.role === nextItem.role &&
    prevItem.type === nextItem.type &&
    prevItem.isError === nextItem.isError &&
    prevItem.messageId === nextItem.messageId &&
    prevItem.clientKey === nextItem.clientKey &&
    prevItem.chatId === nextItem.chatId &&
    prevItem.feedback === nextItem.feedback &&
    prevItem.feedbackUpdating === nextItem.feedbackUpdating &&
    prevItem.folded === nextItem.folded &&
    imagesAreEqual
  );
});

export default function ChatScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { getCollections } = useRAGApi();

  const user = useSelector((state: RootState) => state.auth.user);
  const allMessages = useSelector((state: RootState) => state.chat.messages);
  const messages = useMemo(
    () => allMessages.filter((m) => m.type !== 'tool_output'),
    [allMessages]
  );
  const input = useSelector((state: RootState) => state.chat.input);
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const baseModel = useSelector((state: RootState) => state.chat.baseModel);
  const knowledgeBase = useSelector((state: RootState) => state.chat.knowledgeBase);
  const selectedToolNames = useSelector((state: RootState) => state.chat.selectedToolNames);
  const shortTermMemory = useSelector((state: RootState) => state.chat.shortTermMemory);
  const tempChat = useSelector((state: RootState) => state.chat.tempChat);
  const uploadedImages = useSelector((state: RootState) => state.chat.uploadedImages);
  const lastRequest = useSelector((state: RootState) => state.chat.lastRequest);
  const retryMessageId = useSelector((state: RootState) => state.chat.retryMessageId);
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
  const [foldedMessages, setFoldedMessages] = useState<Record<string, boolean>>({});
  const [isUploading, setIsUploading] = useState(false);
  const isNearBottomRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const previousLoadingRef = useRef(isLoading);
  const retryPendingRef = useRef(false);

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

  const scheduleScrollToEnd = useCallback((animated: boolean) => {
    if (scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!previousLoadingRef.current && isLoading) {
      isNearBottomRef.current = true;
      scheduleScrollToEnd(false);
    } else if (previousLoadingRef.current && !isLoading && isNearBottomRef.current) {
      scheduleScrollToEnd(true);
    }

    previousLoadingRef.current = isLoading;
  }, [isLoading, scheduleScrollToEnd]);

  useEffect(() => {
    if (!isLoading) {
      retryPendingRef.current = false;
    }
  }, [isLoading]);

  const handleSend = () => {
    if (!input.trim() && uploadedImages.length === 0) {
      return;
    }

    const turnMessageId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    isNearBottomRef.current = true;

    const userMessage = {
      role: 'user',
      content: input,
      type: 'user' as const,
      messageId: turnMessageId,
      clientKey: `${turnMessageId}:user`,
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
        short_term_memory: shortTermMemory,
        temp_chat: tempChat,
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

  const handleRetryLastTurn = useCallback(() => {
    if (isLoading || !lastRequest || retryPendingRef.current) {
      return;
    }

    retryPendingRef.current = true;
    isNearBottomRef.current = true;
    dispatch(prepareLastTurnRetry());
    dispatch(sendMessage(lastRequest));
    setIsComposerCollapsed(true);
  }, [dispatch, isLoading, lastRequest]);

  const toggleFolded = useCallback((messageKey: string, currentState: boolean) => {
    setFoldedMessages((prev) => ({
      ...prev,
      [messageKey]: !currentState,
    }));
  }, []);

  const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    isNearBottomRef.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - AUTO_SCROLL_THRESHOLD_PX;
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (isNearBottomRef.current || isLoading) {
      scheduleScrollToEnd(!isLoading);
    }
  }, [isLoading, scheduleScrollToEnd]);

  const handleListLayout = useCallback(() => {
    scheduleScrollToEnd(false);
  }, [scheduleScrollToEnd]);

  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const messageKey = getMessageKey(item, index);

    return (
      <MessageItem 
        item={item}
        messageKey={messageKey}
        isFolded={foldedMessages[messageKey] ?? item.folded ?? false}
        onToggleFold={toggleFolded}
        canRetry={!isLoading && item.messageId === retryMessageId}
        onRetry={handleRetryLastTurn}
        onFeedback={handleFeedback}
      />
    );
  }, [foldedMessages, handleFeedback, handleRetryLastTurn, isLoading, retryMessageId, toggleFolded]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={{ flex: 1 }}
      >
        <View style={styles.configPanel}>
          <Pressable style={styles.configToggleButton} onPress={() => setIsConfigExpanded((prev) => !prev)}>
            <Text style={styles.configToggleText}>Chat Configuration</Text>
            <MaterialCommunityIcons name={isConfigExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#D1D5DB" />
          </Pressable>

          {isConfigExpanded && (
            <View style={{ gap: 8 }}>
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

              <Pressable
                style={[styles.tempChatButton, tempChat && styles.tempChatButtonActive]}
                onPress={() => dispatch(setTempChat(!tempChat))}
                disabled={isLoading}
                accessibilityRole="switch"
                accessibilityState={{ checked: tempChat, disabled: isLoading }}
                accessibilityLabel="Temporary chat"
                accessibilityHint="Prevents this turn from being saved to chat history or sent to Datadog LLM Observability"
              >
                <MaterialCommunityIcons
                  name="incognito"
                  size={22}
                  color={tempChat ? Colors.primary : Colors.textMuted}
                />
                <View style={styles.tempChatCopy}>
                  <Text style={styles.tempChatTitle}>Temporary chat</Text>
                  <Text style={styles.tempChatDescription}>
                    Not saved to chat history or Datadog. Model providers still process it.
                  </Text>
                </View>
                <View style={[styles.tempChatStatus, tempChat && styles.tempChatStatusActive]}>
                  <Text style={[styles.tempChatStatusText, tempChat && styles.tempChatStatusTextActive]}>
                    {tempChat ? 'On' : 'Off'}
                  </Text>
                </View>
              </Pressable>

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
            </View>
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
          keyExtractor={getMessageKey}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          initialNumToRender={FLAT_LIST_INITIAL_RENDER_COUNT}
          maxToRenderPerBatch={FLAT_LIST_BATCH_RENDER_COUNT}
          windowSize={FLAT_LIST_WINDOW_SIZE}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={handleListScroll}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleListLayout}
        />

        {uploadedImages.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentPreviewWrap}>
            {uploadedImages.map((file, index) => (
              <View 
                key={`${file.path}-${index}`} 
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
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.inputContainer}>
          <View>
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
                  blurOnSubmit={true}
                  onSubmitEditing={handleSend}
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
          </View>
        </View>
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
  tempChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Typography.spacing['2xs'],
    backgroundColor: Colors.bgDeep,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tempChatButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  tempChatCopy: {
    flex: 1,
    gap: Typography.spacing['3xs'],
  },
  tempChatTitle: {
    color: Colors.textMain,
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
  },
  tempChatDescription: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    lineHeight: 16,
  },
  tempChatStatus: {
    minWidth: 42,
    borderRadius: 999,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  tempChatStatusActive: {
    backgroundColor: Colors.primary,
  },
  tempChatStatusText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tempChatStatusTextActive: {
    color: Colors.white,
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
  messageImagesContainer: {
    gap: Typography.spacing.xs,
    marginBottom: Typography.spacing.xs,
    alignItems: 'flex-start',
  },
  messageImageFrame: {
    maxWidth: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.bgDeep,
  },
  messageImageFallback: {
    minHeight: 104,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgDeep,
    padding: Typography.spacing.xs,
    justifyContent: 'center',
    gap: Typography.spacing['3xs'],
  },
  messageImageFallbackTitle: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  messageImageFallbackUrl: {
    color: Colors.textDim,
    fontSize: Typography.sizes.xs,
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

const userMarkdownStyles = {
  body: {
    color: Colors.white,
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fonts.sans,
    lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
  },
  code_inline: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Typography.fonts.mono,
    fontSize: Typography.sizes.sm,
    color: Colors.white,
  },
  fence: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 12,
    borderRadius: 8,
    fontFamily: Typography.fonts.mono,
    fontSize: Typography.sizes.sm,
    color: Colors.white,
    marginVertical: Typography.spacing.xs,
  },
  link: {
    color: Colors.white,
    textDecorationLine: 'underline',
  },
  math: {
    color: Colors.white,
    height: 40,
    fontSize: Typography.sizes.base,
  },
  mathBlock: {
    width: '100%',
    marginVertical: Typography.spacing.xs,
  },
};

const markdownStyles = {
  body: {
    color: Colors.textMain,
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fonts.sans,
    lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
  },
  heading1: {
    color: Colors.textMain,
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.bold,
    marginVertical: Typography.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 4,
  },
  heading2: {
    color: Colors.textMain,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    marginVertical: Typography.spacing.xs,
  },
  heading3: {
    color: Colors.textMain,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    marginVertical: Typography.spacing.xs,
  },
  code_inline: {
    backgroundColor: Colors.bgDeep,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Typography.fonts.mono,
    fontSize: Typography.sizes.sm,
    color: Colors.accent,
  },
  fence: {
    backgroundColor: Colors.bgDeep,
    padding: 12,
    borderRadius: 8,
    fontFamily: Typography.fonts.mono,
    fontSize: Typography.sizes.sm,
    color: Colors.textMain,
    marginVertical: Typography.spacing.xs,
  },
  bullet_list: {
    marginVertical: Typography.spacing.xs,
  },
  ordered_list: {
    marginVertical: Typography.spacing.xs,
  },
  list_item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  bullet_list_icon: {
    color: Colors.primary,
    fontSize: 20,
    marginRight: 10,
    lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
  },
  ordered_list_icon: {
    color: Colors.primary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    marginRight: 10,
    lineHeight: Typography.sizes.base * Typography.lineHeights.normal,
  },
  blockquote: {
    backgroundColor: Colors.bgCard,
    borderLeftColor: Colors.primary,
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: Typography.spacing.xs,
    borderRadius: 4,
  },
  link: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginVertical: Typography.spacing.xs,
    overflow: 'hidden',
  },
  thead: {
    backgroundColor: Colors.bgDeep,
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
  },
  th: {
    flex: 1,
    padding: 8,
    fontWeight: Typography.weights.bold,
    color: Colors.textMain,
  },
  td: {
    flex: 1,
    padding: 8,
    color: Colors.textDim,
  },
  math: {
    color: Colors.textMain,
    height: 40,
    fontSize: Typography.sizes.base,
  },
  mathBlock: {
    marginVertical: Typography.spacing.xs,
    width: '100%',
  },
};
