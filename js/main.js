$(async function() {
    if (!setTokenFromStorage()) {
        await login();
    }

    const gridContainer = $('#grid-container');
    
    gridContainer.css({
        'grid-template-columns': `repeat(${GRID_COLUMNS}, 1fr)`,
        'grid-template-rows': `repeat(${GRID_ROWS}, 1fr)`
    });
    
    gridContainer.html(Array(GRID_COLUMNS * GRID_ROWS).fill('<div class="grid-item"></div>').join(''));

    function resizeGrid() {
        const { width: containerWidth, height: containerHeight } = gridContainer[0].getBoundingClientRect();
        const cellWidth = containerWidth / GRID_COLUMNS;
        const cellHeight = containerHeight / GRID_ROWS;

        $('.grid-item').css({
            width: `${cellWidth}px`,
            height: `${cellHeight}px`
        });
    }

    $(window).on('resize', resizeGrid).trigger('resize');

    try {
        const recentResults = await getRecentResults();
        console.log('Recent results:', recentResults);
        // TODO: Process and display the recent results
    } catch (error) {
        console.error('Error getting recent results:', error);
    }
});
