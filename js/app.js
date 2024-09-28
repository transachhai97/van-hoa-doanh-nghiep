import { API_URL, USER_NAME, PASSWORD, GRID_COLUMNS, GRID_ROWS } from './config.js';

// Set up Axios instance with base URL
const api = axios.create({ baseURL: API_URL });

// Local storage utility object
const storage = {
    get: key => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: key => localStorage.removeItem(key)
};

// Request counter for loading overlay
let requestCount = 0;

// Function to show loading overlay
const showLoading = () => {
    requestCount++;
    $('#loading-overlay').removeClass('hidden');
};

// Function to hide loading overlay
const hideLoading = () => {
    if (--requestCount === 0) {
        $('#loading-overlay').addClass('hidden');
    }
};

// Axios request interceptor
api.interceptors.request.use(
    config => (showLoading(), config),
    error => (hideLoading(), Promise.reject(error))
);

// Axios response interceptor
api.interceptors.response.use(
    response => (hideLoading(), response),
    error => {
        hideLoading();
        if (error.response?.status === 401) {
            ['access_token', 'uuid'].forEach(storage.remove);
            delete api.defaults.headers.common['Authorization'];
        }
        return Promise.reject(error);
    }
);

// Authentication module
const auth = {
    // Login function
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

    // Set token from storage
    setTokenFromStorage() {
        const token = storage.get('access_token');
        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            return true;
        }
        return false;
    }
};

// Kahoot API interaction module
const kahoot = {
    // Get recent results
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

    // Fetch report details
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

    // Update grid with data
    updateGridWithData(entities) {
        console.log('entities', entities);
        
        // Nhóm entities theo nickname (phần trước dấu ".")
        const groupedEntities = entities.reduce((groups, entity) => {
            const groupName = entity.controller.nickname.split('.')[0];
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(entity);
            return groups;
        }, {});

        // Tính tổng điểm cho mỗi nhóm
        const groupScores = Object.entries(groupedEntities).map(([groupName, groupEntities]) => ({
            groupName,
            totalScore: groupEntities.reduce((sum, entity) => sum + entity.reportData.correctAnswersCount, 0),
        }));

        // Sắp xếp groupScores theo totalScore giảm dần
        groupScores.sort((a, b) => b.totalScore - a.totalScore);

        console.log('groupScores', groupScores);

        // Cập nhật lưới với thông tin nhóm
        groupScores.forEach((group, index) => {
            const $gridItem = $(`#grid-item-${index}`);
            if ($gridItem.length) {
                $gridItem.html(`
                    <div class="player-info">
                        <p class="nickname" title="${group.groupName}">${group.groupName}</p>
                        <p class="score">${group.totalScore}</p>
                    </div>
                `);
            }
        });

        // Xóa các ô lưới còn lại nếu có ít nhóm hơn số ô lưới
        for (let i = groupScores.length; i < GRID_COLUMNS * GRID_ROWS; i++) {
            $(`#grid-item-${i}`).empty();
        }
    }
};

// UI module
const ui = {
    // Create grid
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

    // Resize grid
    resizeGrid() {
        const $gridContainer = $('#grid-container');
        const gridHeight = $gridContainer.height();
        const gridWidth = $gridContainer.width();

        const cellWidth = gridWidth / GRID_COLUMNS;
        const cellHeight = gridHeight / GRID_ROWS;

        $('.grid-item').css({
            width: `${cellWidth}px`,
            height: `${cellHeight}px`
        });
    },

    // Populate recent results
    async populateRecentResults() {
        const $select = $('#recent-results');
        $select.empty();

        try {
            const recentResults = await kahoot.getRecentResults();
            console.log('Recent results:', recentResults);

            if (recentResults?.entities?.length) {
                const options = recentResults.entities.map(result => ({
                    value: JSON.stringify({ kahootId: result.kahootId, time: result.time }),
                    text: result.name
                }));
                
                $select.append(options.map(option => $('<option>', option)));
                $select.val($select.find('option:first').val());

                const firstItemValue = JSON.parse($select.val());
                const data = await kahoot.fetchReportDetails(firstItemValue.kahootId, firstItemValue.time);
                kahoot.updateGridWithData(data.entities);
            } else {
                $select.append($('<option>', { value: '', text: 'No recent results available' }));
            }
        } catch (error) {
            console.error('Error getting recent results:', error);
            $select.append($('<option>', { value: '', text: 'Error loading recent results' }));
        }
    },

    // Refresh report details
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

    // Toggle fullscreen
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    },

    // Set up event listeners
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

        $('#fullscreen-toggle').off('click').on('click', ui.toggleFullscreen);
    }
};

// Main application initialization function
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

// Run initialization when document is ready
$(initializeApp);