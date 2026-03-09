import Constants from 'expo-constants';

export const getApiUrl = () => {
  return Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000';
};
