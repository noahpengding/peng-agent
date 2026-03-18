import Constants from 'expo-constants';

export const getApiUrl = () => {
  return Constants.expoConfig?.extra?.apiUrl || process.env.API_URL || 'http://localhost:8080';
};
