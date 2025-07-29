import { apiCall } from '../utils/apiUtils';
import { RAGDocument, IndexDocumentRequest } from '../hooks/RAGAPI';

export const RAGService = {
  async getAllRAGDocuments(): Promise<RAGDocument[]> {
    try {
      const response = await apiCall('GET', '/rag');
      return response;
    } catch (error) {
      throw error;
    }
  },

  async indexDocument(request: IndexDocumentRequest): Promise<string> {
    try {
      const response = await apiCall('POST', '/rag', request);
      return response.message;
    } catch (error) {
      throw error;
    }
  },
};
