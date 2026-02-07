import { useCallback, useState } from 'react';
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
  type_of_file: 'standard' | 'handwriting';
}

export const useRAGApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAllRAGDocuments = useCallback(async (): Promise<RAGDocument[]> => {
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
  }, []);

  const indexDocument = useCallback(async (
    username: string,
    filePath: string,
    collectionName: string,
    typeOfFile: 'standard' | 'handwriting'
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const request: IndexDocumentRequest = {
        user_name: username,
        file_path: filePath,
        collection_name: collectionName,
        type_of_file: typeOfFile,
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
  }, []);

  const getCollections = useCallback(async (): Promise<string[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await RAGService.getCollections();
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getAllRAGDocuments,
    indexDocument,
    getCollections,
    isLoading,
    error,
  };
};
