// State management
let currentUser = null;
let isEditMode = false;
let isPasswordVisible = false;
let actualPassword = '';
let allLogs = [];
let filteredLogs = [];

// API base URL
const API_BASE_URL = '/api';

// DOM elements
const searchSection = document.getElementById('searchSection');
const userDetailsSection = document.getElementById('userDetailsSection');
const userFormSection = document.getElementById('userFormSection');
const automationSection = document.getElementById('automationSection');
const logsSection = document.getElementById('logsSection');
const messageBanner = document.getElementById('messageBanner');
const messageText = document.getElementById('messageText');
const deleteModal = document.getElementById('deleteModal');

// Search elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const newUserBtn = document.getElementById('newUserBtn');

// User details elements
const detailUserId = document.getElementById('detailUserId');
const detailPassword = document.getElementById('detailPassword');
const detailLoginTime = document.getElementById('detailLoginTime');
const detailLogoutTime = document.getElementById('detailLogoutTime');
const detailWeekdays = document.getElementById('detailWeekdays');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');
const clearDetailsBtn = document.getElementById('clearDetailsBtn');

// Form elements
const formTitle = document.getElementById('formTitle');
const userForm = document.getElementById('userForm');
const formUserId = document.getElementById('formUserId');
const formPassword = document.getElementById('formPassword');
const formLoginTime = document.getElementById('formLoginTime');
const formLogoutTime = document.getElementById('formLogoutTime');
const toggleFormPasswordBtn = document.getElementById('toggleFormPasswordBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Delete modal elements
const deleteUserId = document.getElementById('deleteUserId');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

// Automation elements
const manualTriggerBtn = document.getElementById('manualTriggerBtn');
const viewLogsBtn = document.getElementById('viewLogsBtn');
const closeLogsBtn = document.getElementById('closeLogsBtn');

// Logs elements
const filterUserId = document.getElementById('filterUserId');
const filterAction = document.getElementById('filterAction');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const logsLoading = document.getElementById('logsLoading');
const logsTable = document.getElementById('logsTable');
const logsTableBody = document.getElementById('logsTableBody');
const noLogs = document.getElementById('noLogs');

// Today status elements
const todayStatusSection = document.getElementById('todayStatusSection');
const loginStatusBadge = document.getElementById('loginStatusBadge');
const logoutStatusBadge = document.getElementById('logoutStatusBadge');
const loginAttempts = document.getElementById('loginAttempts');
const logoutAttempts = document.getElementById('logoutAttempts');
const loginTime = document.getElementById('loginTime');
const logoutTime = document.getElementById('logoutTime');
const lastError = document.getElementById('lastError');

// Weekday mapping
const weekdayNames = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday'
};

// ==================== UI State Functions ====================

function showSearchSection() {
    searchSection.classList.remove('hidden');
    userDetailsSection.classList.add('hidden');
    userFormSection.classList.add('hidden');
    clearBtn.classList.add('hidden');
    searchInput.value = '';
    currentUser = null;
    isEditMode = false;
}

function showUserDetails(user) {
    searchSection.classList.remove('hidden');
    userDetailsSection.classList.remove('hidden');
    userFormSection.classList.add('hidden');
    logsSection.classList.add('hidden');
    clearBtn.classList.remove('hidden');

    currentUser = user;
    actualPassword = user.password;
    isPasswordVisible = false;

    detailUserId.textContent = user.id;
    detailPassword.textContent = '••••••••';
    detailLoginTime.textContent = user.loginTime;
    detailLogoutTime.textContent = user.logoutTime;
    detailWeekdays.textContent = user.weekdays.map(d => weekdayNames[d]).join(', ');
    togglePasswordBtn.textContent = '👁 Show';

    // Display today's status if available
    if (user.todayStatus) {
        displayTodayStatus(user.todayStatus);
    } else {
        todayStatusSection.classList.add('hidden');
    }
}

function displayTodayStatus(status) {
    todayStatusSection.classList.remove('hidden');

    // Login status
    if (status.loginSuccess) {
        loginStatusBadge.textContent = '✓ Success';
        loginStatusBadge.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800';
    } else if (status.loginAttempts > 0) {
        loginStatusBadge.textContent = '✗ Failed';
        loginStatusBadge.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-red-200 text-red-800';
    } else {
        loginStatusBadge.textContent = 'Pending';
        loginStatusBadge.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800';
    }

    loginAttempts.textContent = `Attempts: ${status.loginAttempts}`;
    loginTime.textContent = status.loginTime ? `Last: ${formatTimestamp(status.loginTime)}` : 'Not executed yet';

    // Logout status
    if (status.logoutSuccess) {
        logoutStatusBadge.textContent = '✓ Success';
        logoutStatusBadge.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-green-200 text-green-800';
    } else if (status.logoutAttempts > 0) {
        logoutStatusBadge.textContent = '✗ Failed';
        logoutStatusBadge.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-red-200 text-red-800';
    } else {
        logoutStatusBadge.textContent = 'Pending';
        logoutStatusBadge.className = 'px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800';
    }

    logoutAttempts.textContent = `Attempts: ${status.logoutAttempts}`;
    logoutTime.textContent = status.logoutTime ? `Last: ${formatTimestamp(status.logoutTime)}` : 'Not executed yet';

    // Last error
    if (status.lastError) {
        lastError.textContent = `Error: ${status.lastError}`;
        lastError.classList.remove('hidden');
    } else {
        lastError.classList.add('hidden');
    }
}

function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function showUserForm(user = null) {
    searchSection.classList.add('hidden');
    userDetailsSection.classList.add('hidden');
    userFormSection.classList.remove('hidden');

    isEditMode = !!user;

    if (user) {
        formTitle.textContent = 'Edit User';
        formUserId.value = user.id;
        formUserId.disabled = true;
        formPassword.value = user.password;
        formLoginTime.value = user.loginTime;
        formLogoutTime.value = user.logoutTime;

        // Check appropriate weekdays
        document.querySelectorAll('.weekday-checkbox').forEach(checkbox => {
            checkbox.checked = user.weekdays.includes(parseInt(checkbox.value));
        });
    } else {
        formTitle.textContent = 'Add New User';
        formUserId.disabled = false;
        userForm.reset();

        // Pre-fill with search input if available
        if (searchInput.value.trim()) {
            formUserId.value = searchInput.value.trim();
        }
    }

    clearFormErrors();
}

function showMessage(message, type = 'success') {
    messageBanner.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-blue-100', 'text-green-800', 'text-red-800', 'text-blue-800');

    if (type === 'success') {
        messageBanner.classList.add('bg-green-100', 'text-green-800');
    } else if (type === 'error') {
        messageBanner.classList.add('bg-red-100', 'text-red-800');
    } else {
        messageBanner.classList.add('bg-blue-100', 'text-blue-800');
    }

    messageText.textContent = message;

    // Auto-dismiss success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageBanner.classList.add('hidden');
        }, 5000);
    }
}

function hideMessage() {
    messageBanner.classList.add('hidden');
}

function clearFormErrors() {
    ['errorUserId', 'errorPassword', 'errorLoginTime', 'errorLogoutTime', 'errorWeekdays'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.textContent = '';
        }
    });
}

function showFormErrors(errors) {
    clearFormErrors();

    errors.forEach(error => {
        const errorLower = error.toLowerCase();

        if (errorLower.includes('user id')) {
            document.getElementById('errorUserId').textContent = error;
            document.getElementById('errorUserId').classList.remove('hidden');
        } else if (errorLower.includes('password')) {
            document.getElementById('errorPassword').textContent = error;
            document.getElementById('errorPassword').classList.remove('hidden');
        } else if (errorLower.includes('login time')) {
            document.getElementById('errorLoginTime').textContent = error;
            document.getElementById('errorLoginTime').classList.remove('hidden');
        } else if (errorLower.includes('logout time')) {
            document.getElementById('errorLogoutTime').textContent = error;
            document.getElementById('errorLogoutTime').classList.remove('hidden');
        } else if (errorLower.includes('weekday')) {
            document.getElementById('errorWeekdays').textContent = error;
            document.getElementById('errorWeekdays').classList.remove('hidden');
        }
    });
}

// ==================== API Functions ====================

async function searchUser(id) {
    try {
        hideMessage();
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(id)}`);
        const data = await response.json();

        if (response.ok && data.success) {
            showUserDetails(data.user);
            showMessage(`User "${id}" found`, 'success');
        } else {
            showMessage(data.message || 'User not found', 'error');
            // Ask if they want to create the user
            if (confirm(`User "${id}" not found. Would you like to add this user?`)) {
                showUserForm();
            }
        }
    } catch (error) {
        showMessage('Error searching for user: ' + error.message, 'error');
    }
}

async function saveUser(userData) {
    try {
        hideMessage();
        const response = await fetch(`${API_BASE_URL}/sync-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showMessage(data.message, 'success');

            // Fetch the full user data including password
            await searchUser(userData.id);
        } else {
            showMessage(data.message || 'Failed to save user', 'error');
            if (data.errors && data.errors.length > 0) {
                showFormErrors(data.errors);
            }
        }
    } catch (error) {
        showMessage('Error saving user: ' + error.message, 'error');
    }
}

async function deleteUser(id) {
    try {
        hideMessage();
        const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showMessage(data.message, 'success');
            showSearchSection();
        } else {
            showMessage(data.message || 'Failed to delete user', 'error');
        }
    } catch (error) {
        showMessage('Error deleting user: ' + error.message, 'error');
    }
}

// ==================== Automation Functions ====================

async function handleManualTrigger() {
    try {
        showMessage('Triggering attendance automation...', 'info');

        const response = await fetch(`${API_BASE_URL}/attendance/trigger`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Failed to trigger automation');
        }

        const data = await response.json();
        showMessage('✓ Attendance automation triggered successfully! Check logs for results.', 'success');

        // Refresh current user data after a delay
        if (currentUser) {
            setTimeout(() => handleSearch(), 3000);
        }
    } catch (error) {
        console.error('Error triggering automation:', error);
        showMessage('Failed to trigger automation. Please try again.', 'error');
    }
}

async function handleViewLogs() {
    try {
        searchSection.classList.add('hidden');
        userDetailsSection.classList.add('hidden');
        userFormSection.classList.add('hidden');
        logsSection.classList.remove('hidden');

        await fetchLogs();
    } catch (error) {
        console.error('Error viewing logs:', error);
        showMessage('Failed to load logs. Please try again.', 'error');
    }
}

function handleCloseLogs() {
    logsSection.classList.add('hidden');
    if (currentUser) {
        showUserDetails(currentUser);
    } else {
        showSearchSection();
    }
}

async function fetchLogs() {
    try {
        logsLoading.classList.remove('hidden');
        logsTable.classList.add('hidden');
        noLogs.classList.add('hidden');

        const response = await fetch(`${API_BASE_URL}/attendance/logs?limit=100`);

        if (!response.ok) {
            throw new Error('Failed to fetch logs');
        }

        const data = await response.json();
        allLogs = data.logs || [];
        applyLogFilters();

    } catch (error) {
        console.error('Error fetching logs:', error);
        logsLoading.classList.add('hidden');
        noLogs.classList.remove('hidden');
    }
}

function applyLogFilters() {
    const userIdFilter = filterUserId.value.trim().toLowerCase();
    const actionFilter = filterAction.value;

    filteredLogs = allLogs.filter(log => {
        const matchesUserId = !userIdFilter || log.userId.toLowerCase().includes(userIdFilter);
        const matchesAction = !actionFilter || log.action === actionFilter;
        return matchesUserId && matchesAction;
    });

    displayLogs();
}

function displayLogs() {
    logsLoading.classList.add('hidden');

    if (filteredLogs.length === 0) {
        logsTable.classList.add('hidden');
        noLogs.classList.remove('hidden');
        return;
    }

    noLogs.classList.add('hidden');
    logsTable.classList.remove('hidden');

    logsTableBody.innerHTML = filteredLogs.map(log => {
        const statusClass = log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const statusText = log.success ? '✓ Success' : '✗ Failed';
        const executedTime = new Date(log.executionTime).toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            month: 'short',
            day: 'numeric'
        });

        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium">${log.userId}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${log.action === 'login' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                        ${log.action.toUpperCase()}
                    </span>
                </td>
                <td class="px-4 py-3">${log.scheduledTime}</td>
                <td class="px-4 py-3">${executedTime}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-600">${log.error || '-'}</td>
            </tr>
        `;
    }).join('');
}

// ==================== Event Listeners ====================

function handleSearch() {
    const userId = searchInput.value.trim();
    if (!userId) {
        showMessage('Please enter a User ID', 'error');
        return;
    }
    searchUser(userId);
}

function handleNewUser() {
    showUserForm();
}

function handleEdit() {
    if (currentUser) {
        showUserForm(currentUser);
    }
}

function handleDelete() {
    if (currentUser) {
        deleteUserId.textContent = currentUser.id;
        deleteModal.classList.remove('hidden');
    }
}

function handleConfirmDelete() {
    if (currentUser) {
        deleteUser(currentUser.id);
        deleteModal.classList.add('hidden');
    }
}

function handleCancelDelete() {
    deleteModal.classList.add('hidden');
}

function handleTogglePassword() {
    isPasswordVisible = !isPasswordVisible;
    if (isPasswordVisible) {
        detailPassword.textContent = actualPassword;
        togglePasswordBtn.textContent = '👁 Hide';
    } else {
        detailPassword.textContent = '••••••••';
        togglePasswordBtn.textContent = '👁 Show';
    }
}

function handleToggleFormPassword() {
    if (formPassword.type === 'password') {
        formPassword.type = 'text';
    } else {
        formPassword.type = 'password';
    }
}

function handleFormSubmit(e) {
    e.preventDefault();

    const userId = formUserId.value.trim();
    const password = formPassword.value;
    const loginTime = formLoginTime.value;
    const logoutTime = formLogoutTime.value;

    // Get selected weekdays
    const weekdays = Array.from(document.querySelectorAll('.weekday-checkbox:checked'))
        .map(cb => parseInt(cb.value));

    // Client-side validation
    const errors = [];

    if (!userId) {
        errors.push('User ID is required');
    }

    if (!password || password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (!loginTime) {
        errors.push('Login time is required');
    }

    if (!logoutTime) {
        errors.push('Logout time is required');
    }

    if (weekdays.length === 0) {
        errors.push('At least one weekday must be selected');
    }

    // Check if logout time is after login time
    if (loginTime && logoutTime) {
        const [loginHour, loginMinute] = loginTime.split(':').map(Number);
        const [logoutHour, logoutMinute] = logoutTime.split(':').map(Number);
        const loginMinutes = loginHour * 60 + loginMinute;
        const logoutMinutes = logoutHour * 60 + logoutMinute;

        if (logoutMinutes <= loginMinutes) {
            errors.push('Logout time must be after login time');
        }
    }

    if (errors.length > 0) {
        showFormErrors(errors);
        showMessage('Please fix the validation errors', 'error');
        return;
    }

    const userData = {
        id: userId,
        password: password,
        loginTime: loginTime,
        logoutTime: logoutTime,
        weekdays: weekdays
    };

    saveUser(userData);
}

function handleCancel() {
    if (currentUser) {
        showUserDetails(currentUser);
    } else {
        showSearchSection();
    }
}

function handleClear() {
    showSearchSection();
}

// ==================== Event Listeners ====================

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

clearBtn.addEventListener('click', handleClear);
newUserBtn.addEventListener('click', handleNewUser);

togglePasswordBtn.addEventListener('click', handleTogglePassword);
editBtn.addEventListener('click', handleEdit);
deleteBtn.addEventListener('click', handleDelete);
clearDetailsBtn.addEventListener('click', handleClear);

toggleFormPasswordBtn.addEventListener('click', handleToggleFormPassword);
userForm.addEventListener('submit', handleFormSubmit);
cancelBtn.addEventListener('click', handleCancel);

confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
cancelDeleteBtn.addEventListener('click', handleCancelDelete);

// Automation and logs listeners
manualTriggerBtn.addEventListener('click', handleManualTrigger);
viewLogsBtn.addEventListener('click', handleViewLogs);
closeLogsBtn.addEventListener('click', handleCloseLogs);
applyFiltersBtn.addEventListener('click', applyLogFilters);

// Close modal when clicking outside
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        handleCancelDelete();
    }
});

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Attendance Login Manager loaded');
    showSearchSection();
});
