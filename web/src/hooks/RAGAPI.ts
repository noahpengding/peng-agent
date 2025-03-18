import { useState } from 'react';
import { RAGService } from '../services/ragService';

// Export interfaces for component use
export interface RAGDocument {
  id: string;
  user_name: string;
  knowledge_base: string;
  title: string;
  type: string;
  path: string;
}

export interface IndexDocumentRequest {
  user_name: string;
  file_path: string;
  collection_name: string;
}

export const useRAGApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAllRAGDocuments = async (): Promise<RAGDocument[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await RAGService.getAllRAGDocuments();
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const indexDocument = async (username: string, filePath: string, collectionName: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const request: IndexDocumentRequest = {
        user_name: username,
        file_path: filePath,
        collection_name: collectionName
      };
      
      const message = await RAGService.indexDocument(request);
      return message;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    getAllRAGDocuments,
    indexDocument,
    isLoading,
    error,
  };
};
