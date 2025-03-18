import axios from 'axios';

/**
 * Make an API call with the specified method and endpoint
 */
export const apiCall = async (method: string, endpoint: string, data?: any) => {
  // Use the proxy path instead of the full backend URL
  const url = `/proxy${endpoint}`;
  
  try {
    const response = await axios({
      method,
      url,
      data: (method === 'POST' || method === 'PUT' || method === 'PATCH') ? data : undefined,
      params: method === 'GET' ? data : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Equivalent to credentials: 'include'
    });
    
    // Axios automatically throws errors for non-2xx status codes
    // and automatically parses JSON responses
    
    // For HTTP 204 No Content, return null
    if (response.status === 204) {
      return null;
    }
    
    return response.data;
  } catch (error) {
    console.error('API call failed:', error);
    
    // Extract error message from axios error object
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || 
                          `API error: ${error.response?.status} ${error.response?.statusText}`;
      throw new Error(errorMessage);
    }
    
    throw error;
  }
};
