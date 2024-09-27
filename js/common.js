// Create axios instance
const api = axios.create({
    baseURL: API_URL
});

// Function to login and set access token
async function login() {
    try {
        const response = await api.post('/authenticate', {
            username: USER_NAME,
            password: PASSWORD,
            grant_type: 'password',
        });

        if (response.data && response.data.access_token) {
            // Store the access token in localStorage
            localStorage.setItem('access_token', response.data.access_token);

            // Set the default Authorization header for future requests
            api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;

            console.log('Login successful');
            return true;
        } else {
            console.error('Login failed: No access token received');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        return false;
    }
}

// Function to check if we have a valid token and set it
function setTokenFromStorage() {
    const token = localStorage.getItem('access_token');
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return true;
    }
    return false;
}

// Export the api instance and functions
window.api = api;
window.login = login;
window.setTokenFromStorage = setTokenFromStorage;
