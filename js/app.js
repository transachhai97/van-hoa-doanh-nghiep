import { API_URL, USER_NAME, PASSWORD, GRID_COLUMNS, GRID_ROWS } from './config.js';

const api = axios.create({ baseURL: API_URL });
const storage = {
    get: key => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: key => localStorage.removeItem(key)
};

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            ['access_token', 'uuid'].forEach(storage.remove);
            delete api.defaults.headers.common['Authorization'];
        }
        return Promise.reject(error);
    }
);

const auth = {
    async login() {
        try {
            const { data } = await api.post('/authenticate', {
                username: USER_NAME,
                password: PASSWORD,
                grant_type: 'password',
            });

            if (!data?.access_token) throw new Error('No access token received');

            storage.set('access_token', data.access_token);
            storage.set('uuid', data.user.uuid);
            api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;

            console.log('Login successful');
            return true;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    },

    setTokenFromStorage() {
        const token = storage.get('access_token');
        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            return true;
        }
        return false;
    }
};

const kahoot = {
    async getRecentResults() {
        const params = {
            userId: storage.get('uuid'),
            resultType: 'LIVE_GAME',
            searchMode: 'HOST',
            limit: 10,
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
    },

    async fetchReportDetails(kahootId, time) {
        const uuid = storage.get('uuid');
        const url = `/reports/kahoots/${kahootId}/sessions/${uuid}/${time}/controllers`;
        const params = { orderBy: 'rank', limit: 500 };

        try {
            const { data } = await api.get(url, { params });
            const convertedData = this.convertAndLogData(data.entities);
            console.log('Converted data:', convertedData);
            return data;
        } catch (error) {
            console.error('Error fetching report details:', error);
            return null;
        }
    },

    convertAndLogData(entities) {
        return entities.map(entity => ({
            nickname: entity.controller.nickname,
            answersCount: entity.reportData.answersCount,
            unansweredCount: entity.reportData.unansweredCount,
            correctAnswersCount: entity.reportData.correctAnswersCount
        }));
    }
};

const ui = {
    createGrid() {
        const $gridContainer = $('#grid-container');
        $gridContainer.css({
            'grid-template-columns': `repeat(${GRID_COLUMNS}, 1fr)`,
            'grid-template-rows': `repeat(${GRID_ROWS}, 1fr)`
        });
        $gridContainer.html(Array(GRID_COLUMNS * GRID_ROWS).fill('<div class="grid-item"></div>').join(''));
    },

    resizeGrid() {
        const $gridContainer = $('#grid-container');
        const { width: containerWidth, height: containerHeight } = $gridContainer[0].getBoundingClientRect();
        const cellWidth = containerWidth / GRID_COLUMNS;
        const cellHeight = containerHeight / GRID_ROWS;

        $('.grid-item').css({
            width: `${cellWidth}px`,
            height: `${cellHeight}px`
        });
    },

    async populateRecentResults() {
        const $select = $('#recent-results');
        $select.empty();

        try {
            const recentResults = await kahoot.getRecentResults();
            console.log('Recent results:', recentResults);

            if (recentResults?.entities?.length) {
                $select.append($('<option>', { value: '', text: 'Select a recent result' }));
                recentResults.entities.forEach(result => {
                    $select.append($('<option>', {
                        value: JSON.stringify({ kahootId: result.kahootId, time: result.time }),
                        text: result.name
                    }));
                });
            } else {
                $select.append($('<option>', { value: '', text: 'No recent results available' }));
            }

            $select.on('change', async function() {
                const selectedValue = $(this).val();
                if (selectedValue) {
                    const { kahootId, time } = JSON.parse(selectedValue);
                    console.log('Selected result:', { kahootId, time });

                    try {
                        const reportDetails = await kahoot.fetchReportDetails(kahootId, time);
                        console.log('Report details:', reportDetails);
                        // TODO: Process and display the report details
                    } catch (error) {
                        console.error('Error fetching report details:', error);
                    }
                }
            });
        } catch (error) {
            console.error('Error getting recent results:', error);
            $select.append($('<option>', { value: '', text: 'Error loading recent results' }));
        }
    }
};

async function initializeApp() {
    if (!auth.setTokenFromStorage()) {
        await auth.login();
    }

    ui.createGrid();
    ui.resizeGrid();
    $(window).on('resize', ui.resizeGrid);

    await ui.populateRecentResults();
}

$(initializeApp);
