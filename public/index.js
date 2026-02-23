async function fetchAnnouncements() {
    const announcementList = document.getElementById('announcementList');
    if (!announcementList) {
        console.error('Announcement list element not found');
        return;
    }
    try {
        const response = await fetch('/api/announcements/public');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const announcements = await response.json();
        announcementList.innerHTML = '';
        if (announcements.length === 0) {
            announcementList.innerHTML = '<p>No announcements available.</p>';
        } else {
            announcements.forEach(announcement => {
                const div = document.createElement('div');
                div.innerHTML = `
                    <h3>${announcement.title}</h3>
                    <p>${announcement.content}</p>
                    <p><em>Posted on: ${new Date(announcement.date).toLocaleDateString()}</em></p>
                `;
                announcementList.appendChild(div);
            });
        }
    } catch (err) {
        console.error('Error fetching announcements:', err);
        announcementList.innerHTML = '<p>Failed to load announcements. Please try again later.</p>';
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    if (sidebar && content) {
        sidebar.classList.toggle('open');
        content.classList.toggle('shift');
    } else {
        console.error('Sidebar or content element not found');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAnnouncements();
    const toggleButton = document.getElementById('toggleSidebar');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleSidebar);
    } else {
        console.error('Toggle button not found');
    }
});