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
        
        // Render recent results to select element
        const $select = $('#recent-results');
        $select.empty(); // Clear any existing options
        
        if (recentResults && recentResults.entities) {
            $select.append($('<option>', {
                value: '',
                text: 'Select a recent result'
            }));
            
            recentResults.entities.forEach(result => {
                $select.append($('<option>', {
                    value: result.time,
                    text: result.name,
                }));
            });
        } else {
            $select.append($('<option>', {
                value: '',
                text: 'No recent results available'
            }));
        }

        // Add onchange event handler
        $select.on('change', function() {
            const selectedValue = $(this).val();
            if (selectedValue) {
                console.log('Selected result UUID:', selectedValue);
                // TODO: Add your logic here to handle the selected result
                // For example, you might want to load details for this result
                // loadResultDetails(selectedValue);
            }
        });

    } catch (error) {
        console.error('Error getting recent results:', error);
        $('#recent-results').append($('<option>', {
            value: '',
            text: 'Error loading recent results'
        }));
    }
});

// Example function to load result details (you would implement this)
// async function loadResultDetails(uuid) {
//     try {
//         const details = await getResultDetails(uuid);
//         console.log('Result details:', details);
//         // Update your UI with the details
//     } catch (error) {
//         console.error('Error loading result details:', error);
//     }
// }
