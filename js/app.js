import { API_URL, USER_NAME, PASSWORD, GRID_COLUMNS, GRID_ROWS } from './config.js';

const api = axios.create({ baseURL: API_URL });
const storage = {
    get: key => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: key => localStorage.removeItem(key)
};

let requestCount = 0;

function showLoading() {
    requestCount++;
    $('#loading-overlay').removeClass('hidden');
}

function hideLoading() {
    requestCount--;
    if (requestCount === 0) {
        $('#loading-overlay').addClass('hidden');
    }
}

api.interceptors.request.use(
    config => {
        showLoading();
        return config;
    },
    error => {
        hideLoading();
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    response => {
        hideLoading();
        return response;
    },
    error => {
        hideLoading();
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
        const params = { orderBy: 'rank', limit: 200 };

        try {
            const { data } = await api.get(url, { params });
            return data;
        } catch (error) {
            console.error('Error fetching report details:', error);
            return null;
        }
    },

    updateGridWithData(entities) {
        entities.forEach((entity, index) => {
            const $gridItem = $(`#grid-item-${index}`);
            if ($gridItem.length) {
                $gridItem.html(`
                    <div class="player-info">
                        <p class="nickname">${entity.controller.nickname}</p>
                        <p class="score">Score: ${entity.reportData.correctAnswersCount}</p>
                    </div>
                `);
            }
        });
    }
};

const ui = {
    createGrid() {
        const $gridContainer = $('#grid-container');
        $gridContainer.css({
            'grid-template-columns': `repeat(${GRID_COLUMNS}, 1fr)`,
            'grid-template-rows': `repeat(${GRID_ROWS}, 1fr)`
        });
        
        const gridHtml = Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, index) => {
            const isEven = (Math.floor(index / GRID_COLUMNS) + Math.floor(index % GRID_COLUMNS)) % 2 === 0;
            const colorClass = isEven ? 'color-1' : 'color-2';
            return `<div id="grid-item-${index}" class="grid-item ${colorClass}"></div>`;
        }).join('');

        $gridContainer.html(gridHtml);
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
        const currentValue = $select.val();
        $select.empty();

        try {
            const recentResults = await kahoot.getRecentResults();
            console.log('Recent results:', recentResults);

            if (recentResults?.entities?.length) {
                const options = recentResults.entities.map(result => ({
                    value: JSON.stringify({ kahootId: result.kahootId, time: result.time }),
                    text: result.name
                }));

                options.unshift({ value: '', text: 'Select a recent result' });
                
                $select.append(options.map(option => 
                    $('<option>', option)
                ));

                if (currentValue && $select.find(`option[value='${currentValue}']`).length) {
                    $select.val(currentValue);
                } else {
                    $select.val($select.find('option:first').val());
                }
            } else {
                $select.append($('<option>', { value: '', text: 'No recent results available' }));
            }
        } catch (error) {
            console.error('Error getting recent results:', error);
            $select.append($('<option>', { value: '', text: 'Error loading recent results' }));
        }

        if ($select.val() !== currentValue) {
            $select.trigger('change');
        }
    },

    async refreshReportDetails() {
        const selectedValue = $('#recent-results').val();
        
        if (selectedValue) {
            const { kahootId, time } = JSON.parse(selectedValue);
            console.log('Refreshing report details for:', { kahootId, time });

            try {
                const data = await kahoot.fetchReportDetails(kahootId, time);
                kahoot.updateGridWithData(data.entities);
            } catch (error) {
                console.error('Error refreshing report details:', error);
            }
        } else {
            console.log('No report selected to refresh');
        }
    },

    setupEventListeners() {
        $('#recent-results').off('change').on('change', async function() {
            const selectedValue = $(this).val();
            if (selectedValue) {
                const { kahootId, time } = JSON.parse(selectedValue);
                console.log('Selected result:', { kahootId, time });

                try {
                    const data = await kahoot.fetchReportDetails(kahootId, time);
                    kahoot.updateGridWithData(data.entities);
                } catch (error) {
                    console.error('Error fetching report details:', error);
                }
            }
        });

        $('#refresh-data').off('click').on('click', ui.refreshReportDetails);
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
    ui.setupEventListeners();
}

$(initializeApp);