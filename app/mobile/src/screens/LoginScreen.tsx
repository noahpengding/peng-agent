import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeIn,
  Layout,
  SlideInUp
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { login as loginAction } from '@/store/slices/authSlice';
import { login as loginApi } from '@/utils/authUtils';
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const HERO_IMAGE = require('../../assets/splash.png');

export default function LoginScreen() {
  const dispatch = useDispatch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => username.trim().length > 0 && password.length > 0 && !isSubmitting, [isSubmitting, password.length, username]);

  const handleLogin = async () => {
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await loginApi(username.trim(), password);
      dispatch(loginAction(response.access_token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <Animated.View entering={FadeIn.duration(1500)} style={styles.backgroundTopGlow} />
        <Animated.View entering={FadeIn.duration(1500)} style={styles.backgroundBottomGlow} />

        <Animated.View entering={SlideInUp.delay(200)} style={styles.heroWrap}>
          <Image source={HERO_IMAGE} style={styles.heroImage} resizeMode="cover" />
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.springify().damping(20).stiffness(90)} 
          style={styles.card}
        >
          <Animated.View entering={FadeInDown.delay(400)}>
            <Text style={styles.title}>Peng Agent</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500)} style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(600)} style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
                <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#CBD5E1" />
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View layout={Layout.springify()}>
            {error ? (
              <Animated.View entering={FadeInDown} style={styles.errorWrap}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FCA5A5" />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(700)}>
            <Pressable 
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} 
              onPress={handleLogin} 
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>Sign in</Text>
              )}
            </Pressable>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Typography.spacing.lg,
    backgroundColor: Colors.bgDeep,
  },
  backgroundTopGlow: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.primarySoft,
    opacity: 0.6,
  },
  backgroundBottomGlow: {
    position: 'absolute',
    bottom: -150,
    right: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    opacity: 0.5,
  },
  heroWrap: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: Typography.spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  heroImage: {
    width: '100%',
    height: 140,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 28,
    padding: Typography.spacing.lg,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  title: {
    color: Colors.primary,
    fontSize: Typography.sizes['2xl'],
    fontWeight: Typography.weights.black,
    letterSpacing: Typography.letterSpacing.tight,
  },
  subtitle: {
    marginTop: Typography.spacing['2xs'],
    marginBottom: Typography.spacing.md,
    color: Colors.textDim,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
  },
  inputGroup: {
    marginBottom: Typography.spacing.sm,
  },
  label: {
    marginBottom: Typography.spacing['2xs'],
    color: Colors.primary,
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.bgDeep,
    color: Colors.textMain,
    paddingHorizontal: Typography.spacing.sm,
    paddingVertical: Typography.spacing.sm,
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fonts.sans,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.bgDeep,
  },
  passwordInput: {
    flex: 1,
    color: Colors.textMain,
    paddingHorizontal: Typography.spacing.sm,
    paddingVertical: Typography.spacing.sm,
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fonts.sans,
  },
  eyeButton: {
    paddingHorizontal: Typography.spacing.sm,
  },
  errorWrap: {
    marginTop: Typography.spacing['3xs'],
    marginBottom: Typography.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Typography.spacing['2xs'],
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: Colors.error,
    borderWidth: 1,
    borderRadius: 14,
    padding: Typography.spacing.sm,
  },
  errorText: {
    color: Colors.error,
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
  },
  submitButton: {
    marginTop: Typography.spacing['2xs'],
    borderRadius: 14,
    paddingVertical: Typography.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitText: {
    color: Colors.white,
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.base,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
  },
});
