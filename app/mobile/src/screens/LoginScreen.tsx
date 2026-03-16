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
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { login as loginAction } from '@share/store/slices/authSlice';
import { login as loginApi } from '@share/utils/authUtils';

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
        <View style={styles.backgroundTopGlow} />
        <View style={styles.backgroundBottomGlow} />

        <View style={styles.heroWrap}>
          <Image source={HERO_IMAGE} style={styles.heroImage} resizeMode="cover" />
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Peng Agent</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.inputGroup}>
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
          </View>

          <View style={styles.inputGroup}>
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
          </View>

          {error ? (
            <View style={styles.errorWrap}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FCA5A5" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleLogin} disabled={!canSubmit}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Sign in</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1520',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#1A1520',
  },
  backgroundTopGlow: {
    position: 'absolute',
    top: -140,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
  },
  backgroundBottomGlow: {
    position: 'absolute',
    bottom: -180,
    right: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(109, 40, 217, 0.16)',
  },
  heroWrap: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroImage: {
    width: '100%',
    height: 130,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: 18,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    color: '#94A3B8',
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
    color: '#CBD5E1',
    fontWeight: '600',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  passwordInput: {
    flex: 1,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 12,
  },
  errorWrap: {
    marginTop: 4,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: 'rgba(239, 68, 68, 0.32)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: '#FCA5A5',
    flex: 1,
    fontSize: 13,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
