import { useState } from 'react';
import { API_BASE_URL } from "../config/config";

export interface RAGDocument {
  id: number;
  user_name: string;
  knowledge_base: string;
  title: string;
  type: string;
  path: string;
}

export const useRAGApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAllRAGDocuments = async (): Promise<RAGDocument[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/rag`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
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
      const payload = {
        user_name: username,
        file_path: filePath,
        collection_name: collectionName
      };
      
      const response = await fetch(`${API_BASE_URL}/rag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.message || 'Document indexed successfully';
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
