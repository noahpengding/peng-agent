import { useState } from 'react';
import { API_BASE_URL } from "../config/config";

export interface Memory {
    id: string;
    user_name: string;
    base_model: string;
    knowledge_base: string;
    human_input: string;
    ai_response: string;
}

export const useMemoryApi = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fetchMemories = async (): Promise<Memory[]> => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${API_BASE_URL}/memory`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            // Map the array of data to Memory objects
            return Array.isArray(data) ? data.map(item => ({
                id: item.id,
                user_name: item.user_name,
                base_model: item.base_model,
                knowledge_base: item.knowledge_base,
                human_input: item.human_input,
                ai_response: item.ai_response
            })) : [];
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { fetchMemories, isLoading, error };
}