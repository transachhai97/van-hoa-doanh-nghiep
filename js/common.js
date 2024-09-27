const api = axios.create({ baseURL: API_URL });

// Add a response interceptor
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            ['access_token', 'uuid'].forEach(key => localStorage.removeItem(key));
            delete api.defaults.headers.common['Authorization'];
        }
        return Promise.reject(error);
    }
);

async function login() {
    try {
        const { data } = await api.post('/authenticate', {
            username: USER_NAME,
            password: PASSWORD,
            grant_type: 'password',
        });

        if (!data?.access_token) throw new Error('No access token received');

        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('uuid', data.user.uuid);
        api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;

        console.log('Login successful');
        return true;
    } catch (error) {
        console.error('Login error:', error);
        return false;
    }
}

function setTokenFromStorage() {
    const token = localStorage.getItem('access_token');
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return true;
    }
    return false;
}

async function getRecentResults() {
    const params = {
        userId: localStorage.getItem('uuid'),
        resultType: 'LIVE_GAME',
        searchMode: 'HOST',
        limit: 5,
        orderBy: 'time',
        reverse: true
    };

    try {
        const { data } = await api.get('/results/browse', { params });
        return data;
    } catch (error) {
        console.error('Error fetching recent results:', error);
        return null;
    }
}

Object.assign(window, { api, login, setTokenFromStorage, getRecentResults });
