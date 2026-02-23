// Unified sidebar functionality for all pages
document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    const menuClose = document.getElementById('menuClose');

    if (toggleButton && sidebar && content) {
        // Remove any existing listeners to prevent duplicates
        toggleButton.replaceWith(toggleButton.cloneNode(true));
        const newToggleButton = document.getElementById('toggleSidebar');
        
        newToggleButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle('open');
            content.classList.toggle('shift');
            console.log('Sidebar toggled'); // Debug log
        });
    }

    if (menuClose) {
        // Remove any existing listeners to prevent duplicates
        menuClose.replaceWith(menuClose.cloneNode(true));
        const newMenuClose = document.getElementById('menuClose');
        
        newMenuClose.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.remove('open');
            content.classList.remove('shift');
            console.log('Sidebar closed'); // Debug log
        });
    }
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            const isClickInside = sidebar.contains(e.target) || toggleButton.contains(e.target);
            if (!isClickInside && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                content.classList.remove('shift');
            }
        }
    });
});