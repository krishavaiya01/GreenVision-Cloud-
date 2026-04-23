import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5050/api', // Use full backend URL for local dev
  withCredentials: true // Send cookies for auth if needed
});

// Helper: Extract token from localStorage or sessionStorage
function getAuthToken() {
  // Try localStorage first, fallback to sessionStorage
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
}

// Optional: Add interceptors for auth, error handling, etc.
apiClient.interceptors.request.use(config => {
  const token = getAuthToken();
  console.log("➡️ Sending token:", token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Remove header if no token
    delete config.headers.Authorization;
  }
  return config;
}, error => Promise.reject(error));

// Optional: Add response error handling for 401
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // Optionally clear token and redirect to login
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      // window.location.href = '/login'; // Uncomment to auto-redirect
    }
    return Promise.reject(error);
  }
);
export default apiClient;
