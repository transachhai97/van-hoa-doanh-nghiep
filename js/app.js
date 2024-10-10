import { API_URL, USER_NAME, PASSWORD, GRID_COLUMNS_LANDSCAPE, GRID_ROWS_LANDSCAPE, GRID_COLUMNS_PORTRAIT, GRID_ROWS_PORTRAIT } from './config.js';
import { FireworksManager } from './fireworks.js';
import { dataArray } from './data.js'; // Import dataArray from data.js

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
        
        // Group entities by nickname (part before ".")
        const groupedEntities = entities.reduce((groups, entity) => {
            const groupName = entity.controller.nickname.split('/')[0];
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(entity);
            return groups;
        }, {});

        // Calculate total score for each group
        const groupScores = Object.entries(groupedEntities).map(([groupName, groupEntities]) => ({
            groupName,
            totalScore: groupEntities.reduce((sum, entity) => sum + entity.reportData.correctAnswersCount, 0),
        }));

        // Sort groupScores by totalScore (descending) and then by groupName (ascending)
        groupScores.sort((a, b) => {
            if (b.totalScore !== a.totalScore) {
                return b.totalScore - a.totalScore;
            }
            return a.groupName.localeCompare(b.groupName);
        });

        console.log('groupScores', groupScores);

        // Update grid with group information
        groupScores.forEach((group, index) => {
            const $gridItem = $(`#grid-item-${index}`);
            if ($gridItem.length) {
                $gridItem.html(`
                    <div class="player-info">
                        <p class="nickname" title="${group.groupName}">${group.groupName.toUpperCase()}</p>
                        <p class="score">${group.totalScore ? group.totalScore * 4 : '&nbsp;'}</p>
                    </div>
                `);
            }
        });

        // Clear remaining grid items if there are fewer groups than grid cells
        for (let i = groupScores.length; i < ui.getGridSize(); i++) {
            $(`#grid-item-${i}`).empty();
        }

        // Trigger fireworks after updating the grid
        ui.triggerFireworks();
    }
};

// UI module
const ui = {
    fireworksManager: null,
    isLandscape: window.innerWidth > window.innerHeight,

    // Create grid
    createGrid() {
        const $gridContainer = $('#grid-container');
        this.updateGridLayout();
        
        const gridHtml = Array.from({ length: this.getGridSize() }, (_, index) => {
            const isEven = (Math.floor(index / this.getColumns()) + index % this.getColumns()) % 2 === 0;
            const colorClass = isEven ? 'color-1' : 'color-2';
            return `<div id="grid-item-${index}" class="grid-item ${colorClass}"></div>`;
        }).join('');

        $gridContainer.html(gridHtml);
        this.resizeGrid();
    },

    // Update grid layout based on orientation
    updateGridLayout() {
        const $gridContainer = $('#grid-container');
        this.isLandscape = window.innerWidth > window.innerHeight;
        
        $gridContainer.css({
            'grid-template-columns': `repeat(${this.getColumns()}, 1fr)`,
            'grid-template-rows': `repeat(${this.getRows()}, 1fr)`
        });
    },

    // Get current number of columns
    getColumns() {
        return this.isLandscape ? GRID_COLUMNS_LANDSCAPE : GRID_COLUMNS_PORTRAIT;
    },

    // Get current number of rows
    getRows() {
        return this.isLandscape ? GRID_ROWS_LANDSCAPE : GRID_ROWS_PORTRAIT;
    },

    // Get total grid size
    getGridSize() {
        return this.getColumns() * this.getRows();
    },

    // Resize grid
    resizeGrid() {
        const $gridContainer = $('#grid-container');
        const gridHeight = $gridContainer.height();
        const gridWidth = $gridContainer.width();

        const cellWidth = gridWidth / this.getColumns();
        const cellHeight = gridHeight / this.getRows();

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

                options.push({value: 'all', text: 'Danh sách thí sinh'});
                
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
        
        if (selectedValue === 'all') {
            // Update grid with data from dataArray
            kahoot.updateGridWithData(dataArray.map(name => ({ controller: { nickname: name }, reportData: { correctAnswersCount: Math.floor(Math.random() * 100) } })));
        } else if (selectedValue) {
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

    // Initialize fireworks
    initFireworks() {
        const canvas = document.getElementById('fireworks-canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.fireworksManager = new FireworksManager(canvas);
        $(canvas).hide(); // Hide canvas initially
    },

    // Trigger fireworks
    triggerFireworks() {
        if (this.fireworksManager) {
            this.fireworksManager.start();
        }
    },

    // Stop fireworks
    stopFireworks() {
        if (this.fireworksManager) {
            this.fireworksManager.stop();
        }
    },

    // Toggle fireworks
    toggleFireworks() {
        if (this.fireworksManager) {
            this.fireworksManager.toggle();
            const $footerText = $('#footer-text');
            const $fireworksCanvas = $('#fireworks-canvas');
            
            if (this.fireworksManager.isRunning) {
                $footerText.addClass('fireworks-active');
                $fireworksCanvas.show();
            } else {
                $footerText.removeClass('fireworks-active');
                $fireworksCanvas.hide();
            }
        }
    },

    // Set up event listeners
    setupEventListeners() {
        $('#recent-results').off('change').on('change', async function() {
            const selectedValue = $(this).val();
            if (selectedValue === 'all') {
                // Update grid with data from dataArray
                kahoot.updateGridWithData(dataArray.map(name => ({ controller: { nickname: name }, reportData: { correctAnswersCount: 0 } })));
            } else if (selectedValue) {
                const { kahootId, time } = JSON.parse(selectedValue);
                console.log('Selected result:', { kahootId, time });

                try {
                    const data = await kahoot.fetchReportDetails(kahootId, time);
                    kahoot.updateGridWithData(data.entities);
                } catch (error) {
                    console.error('Error fetching report details:', error);
                }
            } else {
                console.log('No report selected to refresh');
            }
        });

        $('#refresh-data').off('click').on('click', ui.refreshReportDetails);

        $('#fullscreen-toggle').off('click').on('click', ui.toggleFullscreen);

        $('#toggle-fireworks').off('click').on('click', () => this.toggleFireworks());

        $('#footer-text').off('click').on('click', () => this.toggleFireworks());

        $(window).on('resize', () => {
            const wasLandscape = this.isLandscape;
            this.isLandscape = window.innerWidth > window.innerHeight;
            
            if (wasLandscape !== this.isLandscape) {
                this.createGrid();
                this.updateGridWithCurrentData();
            } else {
                this.updateGridLayout();
                this.resizeGrid();
            }
            
            this.updateFooterLayout();
            
            if (this.fireworksManager) {
                const canvas = document.getElementById('fireworks-canvas');
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        });

        $('#stop-fireworks').off('click').on('click', () => this.stopFireworks());

        // Add new key press event listener
        let isAPressed = false;
        let isDPressed = false;

        $(document).on('keydown', (e) => {
            if (e.key.toLowerCase() === 'a') {
                isAPressed = true;
            }
            if (e.key.toLowerCase() === 'd') {
                isDPressed = true;
            }

            if (isAPressed && isDPressed) {
                this.refreshReportDetails();
            }
        });

        $(document).on('keyup', (e) => {
            if (e.key.toLowerCase() === 'a') {
                isAPressed = false;
            }
            if (e.key.toLowerCase() === 'd') {
                isDPressed = false;
            }
        });
    },

    // Thêm phương thức mới để cập nhật lưới với dữ liệu hiện tại
    updateGridWithCurrentData() {
        const selectedValue = $('#recent-results').val();
        if (selectedValue) {
            const { kahootId, time } = JSON.parse(selectedValue);
            kahoot.fetchReportDetails(kahootId, time).then(data => {
                kahoot.updateGridWithData(data.entities);
            });
        }
    },

    updateFooterLayout() {
        const isMobile = window.innerWidth <= 768;
        const $footer = $('#footer');
        const $footerLeft = $('#footer-left');
        const $controls = $('#controls');

        if (isMobile) {
            $footer.css('justify-content', 'center');
            $footerLeft.hide();
            $controls.css('width', '100%');
        } else {
            $footer.css('justify-content', 'space-between');
            $footerLeft.show();
            $controls.css('width', 'auto');
        }
    }
};

// Main application initialization function
async function initializeApp() {
    if (!auth.setTokenFromStorage()) {
        await auth.login();
    }

    ui.createGrid();
    ui.setupEventListeners();
    await ui.populateRecentResults();

    ui.updateGridLayout();
    ui.resizeGrid();
    ui.updateFooterLayout(); // Thêm dòng này

    // Thêm đoạn code sau để khởi tạo fireworks
    ui.initFireworks();
}

// Run initialization when document is ready
$(initializeApp);