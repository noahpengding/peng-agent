import { apiCall } from '../utils/apiCall';
import { Tool } from '@/types/ChatInterface.types';

export const ToolService = {
  async getAllTools(): Promise<Tool[]> {
    try {
      const response = await apiCall('GET', '/tools');
      return response;
    } catch (error) {
      throw error;
    }
  },

  async updateTools(): Promise<string> {
    try {
      const response = await apiCall('POST', '/tools', {});
      return response.message;
    } catch (error) {
      throw error;
    }
  },
};
