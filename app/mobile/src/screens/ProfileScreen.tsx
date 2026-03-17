import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '@share/store/slices/authSlice';
import { UserService } from '@share/services/userService';
import { RootState } from '@share/store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';

import UserProfileModal from '../components/UserProfileModal';
import ModelModal from '../components/ModelModal';
import RAGModal from '../components/RAGModal';
import MemoryModal from '../components/MemoryModal';
import { setError } from '@share/store/slices/chatSlice';

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { availableBaseModels } = useSelector((state: RootState) => state.models);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal visibility states
  const [profileVisible, setProfileVisible] = useState(false);
  const [modelVisible, setModelVisible] = useState(false);
  const [ragVisible, setRagVisible] = useState(false);
  const [memoryVisible, setMemoryVisible] = useState(false);

  const fetchProfile = async () => {
    try {
      const profile = await UserService.getProfile();
      setUsername(profile.username || 'Unknown user');
      setEmail(profile.email || 'No email set');
    } catch {
      dispatch(setError('Failed to fetch profile'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const menuItems: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void; description: string }[] = [
    {
      title: 'User Profile',
      icon: 'account-cog-outline',
      onPress: () => setProfileVisible(true),
      description: 'Manage your personal details and defaults'
    },
    {
      title: 'Model Management',
      icon: 'brain',
      onPress: () => setModelVisible(true),
      description: 'Enable or disable AI models'
    },
    {
      title: 'RAG Documents',
      icon: 'file-document-multiple-outline',
      onPress: () => setRagVisible(true),
      description: 'Upload and index your own documents'
    },
    {
      title: 'Memory Selection',
      icon: 'memory',
      onPress: () => setMemoryVisible(true),
      description: 'Select previous chats to use as context'
    }
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Settings & Profile</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.userCard}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.userInfo}>
                <Text style={styles.username}>{username}</Text>
                <Text style={styles.email}>{email}</Text>
            </View>
          </View>
        )}

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <Pressable key={index} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuIconContainer}>
                <MaterialCommunityIcons name={item.icon} size={24} color="#10B981" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
                <Text style={styles.menuItemDescription}>{item.description}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#4B5563" />
            </Pressable>
          ))}
        </View>

        <View style={styles.externalLinks}>
            <Text style={styles.sectionLabel}>Resources</Text>
            <Pressable
              style={styles.externalLink}
              onPress={() => void Linking.openURL('https://github.com/noahpengding/peng-agent/')}
            >
                <MaterialCommunityIcons name="github" size={20} color="#9CA3AF" />
                <Text style={styles.externalLinkText}>GitHub Repository</Text>
            </Pressable>
        </View>

        <Pressable style={styles.logoutButton} onPress={() => dispatch(logout())}>
          <MaterialCommunityIcons name="logout" size={20} color="#FFFFFF" />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      <UserProfileModal 
        visible={profileVisible} 
        onClose={() => {
            setProfileVisible(false);
            fetchProfile(); // Refresh profile info after edit
        }} 
        availableModels={availableBaseModels}
      />
      <ModelModal 
        visible={modelVisible} 
        onClose={() => setModelVisible(false)} 
      />
      <RAGModal 
        visible={ragVisible} 
        onClose={() => setRagVisible(false)} 
      />
      <MemoryModal 
        visible={memoryVisible} 
        onClose={() => setMemoryVisible(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  container: {
    paddingHorizontal: Typography.spacing.lg,
    paddingTop: Typography.spacing.sm,
  },
  header: {
    marginBottom: Typography.spacing.md,
  },
  title: {
    color: Colors.textMain,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
    letterSpacing: Typography.letterSpacing.tight,
  },
  userCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: Typography.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Typography.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 64,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Typography.spacing.sm,
  },
  avatarText: {
    color: Colors.white,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.black,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: Colors.textMain,
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.extraBold,
  },
  email: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  menuContainer: {
    gap: Typography.spacing.sm,
    marginBottom: Typography.spacing.xl,
  },
  menuItem: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: Typography.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Typography.spacing.sm,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    color: Colors.textMain,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
  },
  menuItemDescription: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.black,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Typography.spacing.xs,
    paddingLeft: 4,
  },
  externalLinks: {
    marginBottom: Typography.spacing.xl,
  },
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Typography.spacing.xs,
    paddingVertical: Typography.spacing.sm,
    paddingHorizontal: 4,
  },
  externalLinkText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  logoutButton: {
    backgroundColor: Colors.error,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Typography.spacing.md,
    gap: Typography.spacing.xs,
    elevation: 4,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: Typography.weights.black,
    fontSize: Typography.sizes.base,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
