import axios from 'axios';

/**
 * Make an API call with the specified method and endpoint
 */
export const apiCall = async (method: string, endpoint: string, data?: any) => {
  // Use the proxy path instead of the full backend URL
  const url = `/proxy${endpoint}`;
  
  // Get token from localStorage for authenticated requests
  const token = localStorage.getItem('jwt_token');
  
  try {
    const response = await axios({
      method,
      url,
      data: (method === 'POST' || method === 'PUT' || method === 'PATCH') ? data : undefined,
      params: method === 'GET' ? data : undefined,
      headers: {
        'Content-Type': 'application/json',
        // Add Authorization header if token exists
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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
    // Extract error message from axios error object
    if (axios.isAxiosError(error)) {
      // Handle authentication errors (401 Unauthorized)
      if (error.response?.status === 401) {
        // Clear the token
        localStorage.removeItem('jwt_token');
        // Redirect to login page if we're in a browser environment
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      
      const errorMessage = error.response?.data?.message || 
                          `API error: ${error.response?.status} ${error.response?.statusText}`;
      throw new Error(errorMessage);
    }
    
    throw error;
  }
};
