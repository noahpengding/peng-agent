import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '@share/store/slices/authSlice';
import { UserService } from '@share/services/userService';
import { RootState } from '@share/store';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import UserProfileModal from '../components/UserProfileModal';
import ModelModal from '../components/ModelModal';
import RAGModal from '../components/RAGModal';
import MemoryModal from '../components/MemoryModal';

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { availableBaseModels } = useSelector((state: RootState) => state.models);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const menuItems = [
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
    <SafeAreaView style={styles.safeArea}>
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
                <MaterialCommunityIcons name={item.icon as any} size={24} color="#10B981" />
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
            <Pressable style={styles.externalLink}>
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
        availableModels={availableBaseModels as any}
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
    backgroundColor: '#1a1a1a',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '800',
  },
  userCard: {
    backgroundColor: '#2F3237',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#374151',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: 'bold',
  },
  email: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 2,
  },
  menuContainer: {
    gap: 12,
    marginBottom: 30,
  },
  menuItem: {
    backgroundColor: '#2F3237',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  menuItemDescription: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingLeft: 5,
  },
  externalLinks: {
    marginBottom: 30,
  },
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  externalLinkText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
