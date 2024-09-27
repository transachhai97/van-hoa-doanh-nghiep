$(document).ready(function() {
    const gridContainer = $('#grid-container');
    
    // Set grid template
    gridContainer.css({
        'grid-template-columns': `repeat(${GRID_COLUMNS}, 1fr)`,
        'grid-template-rows': `repeat(${GRID_ROWS}, 1fr)`
    });
    
    // Create grid
    for (let i = 0; i < GRID_COLUMNS * GRID_ROWS; i++) {
        gridContainer.append('<div class="grid-item"></div>');
    }

    // Make the grid responsive
    function resizeGrid() {
        const containerWidth = gridContainer.width();
        const containerHeight = gridContainer.height();
        const cellWidth = containerWidth / GRID_COLUMNS;
        const cellHeight = containerHeight / GRID_ROWS;

        $('.grid-item').css({
            'width': cellWidth + 'px',
            'height': cellHeight + 'px'
        });
    }

    $(window).on('resize', resizeGrid).trigger('resize');
});
