import axios from 'axios';

// Professional Environment Detection for Codespaces
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  
  const codespaceName = import.meta.env.VITE_CODESPACE_NAME;
  if (codespaceName) {
    return `https://${codespaceName}-5000.app.github.dev/api`;
  }
  
  return 'http://localhost:5000/api';
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: No need to attach header manually, cookies are sent automatically
apiClient.interceptors.request.use((config) => {
  return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Handle automated logout on 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Tokens are httpOnly cookies, frontend can just redirect to login
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
