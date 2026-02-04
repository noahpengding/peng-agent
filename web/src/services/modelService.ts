import { apiCall } from '../utils/apiUtils';
import { Model } from '../hooks/ModelAPI';

export const ModelService = {
  async getAllModels(): Promise<Model[]> {
    try {
      const response = await apiCall('GET', '/model');
      return response;
    } catch (error) {
      throw error;
    }
  },

  async getAvailableModels(type: string): Promise<Model[]> {
    try {
      const response = await apiCall('POST', `/avaliable_model`, { type: type });
      return response;
    } catch (error) {
      throw error;
    }
  },

  async getAvailableBaseModels(): Promise<Model[]> {
    return this.getAvailableModels('base');
  },

  async toggleModelAvailability(modelName: string): Promise<string> {
    try {
      const response = await apiCall('POST', '/model_avaliable', { model_name: modelName });
      return response.message;
    } catch (error) {
      throw error;
    }
  },

  async toggleModelMultimodal(modelName: string, column: string): Promise<string> {
    try {
      const response = await apiCall('POST', '/model_multimodal', { model_name: modelName, column });
      return response.message;
    } catch (error) {
      throw error;
    }
  },

  async toggleModelReasoningEffect(modelName: string, reasoning_effect: string): Promise<string> {
    try {
      const response = await apiCall('POST', '/model_reasoning_effect', { model_name: modelName, reasoning_effect });
      return response.message;
    } catch (error) {
      throw error;
    }
  },

  async refreshModels(): Promise<string> {
    try {
      const response = await apiCall('GET', '/model_refresh', {});
      return response.message;
    } catch (error) {
      throw error;
    }
  },
};
