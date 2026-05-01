/**
 * Main Application Controller
 * Initializes and coordinates all modules
 */

const App = {
    currentView: 'dashboard',
    initialized: false,

    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) return;

        try {
            // Show loading screen
            this.showLoading();

            // Check storage availability
            if (!StorageManager.isAvailable()) {
                throw new Error('localStorage is not available');
            }

            // Initialize all modules with error handling
            try {
                TaskManager.init();
                HabitManager.init();
                GoalManager.init();
                TimeTracker.init();
                ScreentimeTracker.init();
                ReflectionManager.init();
                PromptFlow.init();
            } catch (moduleError) {
                console.error('Module initialization error:', moduleError);
                // Continue anyway - modules will work with empty data
            }

            // Setup event listeners
            this.setupEventListeners();

            // Update header info
            this.updateHeader();

            // Hide loading and show app
            await Utils.sleep(500); // Brief delay for smooth transition
            this.hideLoading();

            // Start appropriate flow
            this.startApp();

            this.initialized = true;
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize app: ' + error.message);
        }
    },

    /**
     * Start the application flow
     */
    startApp() {
        // Always show the main app container first
        const promptContainer = document.getElementById('prompt-container');
        const mainApp = document.getElementById('main-app');
        
        // Check if check-in is needed
        if (CommitmentTracker.needsMorningCheckin() || CommitmentTracker.needsEveningCheckin()) {
            if (promptContainer) promptContainer.style.display = 'block';
            if (mainApp) mainApp.style.display = 'none';
            PromptFlow.startCheckIn();
        } else {
            // Go directly to dashboard
            if (promptContainer) promptContainer.style.display = 'none';
            if (mainApp) mainApp.style.display = 'grid';
            this.showDashboard();
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.showView(view);
            });
        });

        // Menu toggle (mobile)
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });

            // Close sidebar when clicking outside on mobile
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                        sidebar.classList.remove('active');
                    }
                }
            });
        }

        // Update check-in button
        const updateCheckinBtn = document.getElementById('update-checkin-btn');
        if (updateCheckinBtn) {
            updateCheckinBtn.addEventListener('click', () => {
                PromptFlow.startCheckIn();
            });
        }

        // Export data button
        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                DataManager.exportData();
            });
        }

        // Timer update interval
        setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    },

    /**
     * Show view
     */
    showView(viewName) {
        this.currentView = viewName;

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === viewName) {
                link.classList.add('active');
            }
        });

        // Close mobile menu
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('active');
        }

        // Render view
        const container = document.getElementById('main-content');
        if (!container) return;

        switch (viewName) {
            case 'dashboard':
                Dashboard.render();
                break;
            case 'obligations':
                this.renderObligationsView();
                break;
            case 'tasks':
                this.renderTasksView();
                break;
            case 'habits':
                this.renderHabitsView();
                break;
            case 'goals':
                this.renderGoalsView();
                break;
            case 'time':
                this.renderTimeView();
                break;
            case 'screentime':
                this.renderScreentimeView();
                break;
            case 'reflections':
                this.renderReflectionsView();
                break;
            case 'history':
                this.renderHistoryView();
                break;
            case 'settings':
                DataManager.renderSettings();
                break;
            default:
                Dashboard.render();
        }
    },

    /**
     * Show dashboard
     */
    showDashboard() {
        // Ensure main app is visible
        const promptContainer = document.getElementById('prompt-container');
        const mainApp = document.getElementById('main-app');
        
        if (promptContainer) promptContainer.style.display = 'none';
        if (mainApp) mainApp.style.display = 'grid';
        
        // Set current view and update navigation
        this.currentView = 'dashboard';
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === 'dashboard') {
                link.classList.add('active');
            }
        });
        
        // Render dashboard
        Dashboard.render();
    },

    /**
     * Render obligations view
     */
    renderObligationsView() {
        console.log('renderObligationsView called');
        const container = document.getElementById('main-content');
        if (!container) {
            console.error('main-content container not found');
            return;
        }
        const today = Utils.getTodayString();
        console.log('Today:', today);
        const commitment = StorageManager.getCommitments(today);
        console.log('Commitment:', commitment);
        const obligations = (commitment && commitment.obligations) ? commitment.obligations : [];
        console.log('Obligations:', obligations);
        
        const completedCount = obligations.filter(o => o.completed).length;
        const totalCount = obligations.length;
        
        let html = '<div class="view-header">';
        html += '<h1>📋 Today\'s Obligations</h1>';
        html += '<div class="header-stats">';
        html += '<span class="completion-badge ' + (completedCount === totalCount && totalCount > 0 ? 'complete' : '') + '">';
        html += completedCount + '/' + totalCount + ' Complete';
        html += '</span></div></div>';
        
        if (obligations.length === 0) {
            html += '<div class="empty-state">';
            html += '<div class="empty-icon">📋</div>';
            html += '<h3>No obligations for today</h3>';
            html += '<p>Set obligations during your evening check-in to see them here tomorrow.</p>';
            html += '</div>';
        } else {
            html += '<div class="obligations-list">';
            obligations.forEach((obligation, index) => {
                html += '<div class="obligation-card ' + (obligation.completed ? 'completed' : '') + '">';
                html += '<div class="obligation-checkbox">';
                html += '<input type="checkbox" id="obligation-' + index + '" ' + (obligation.completed ? 'checked' : '') + ' onchange="App.toggleObligation(' + index + ')">';
                html += '<label for="obligation-' + index + '"></label>';
                html += '</div>';
                html += '<div class="obligation-content">';
                html += '<h3 class="obligation-title">' + Utils.escapeHtml(obligation.title) + '</h3>';
                html += '<div class="obligation-time">';
                html += '<span class="time-icon">⏰</span>';
                html += '<span>' + Utils.formatTimeString(obligation.time) + '</span>';
                html += '</div></div>';
                if (obligation.completed) {
                    html += '<div class="completion-badge">✓</div>';
                }
                html += '</div>';
            });
            html += '</div>';
            
            if (completedCount === totalCount && totalCount > 0) {
                html += '<div class="success-message">';
                html += '<h3>🎉 All obligations complete!</h3>';
                html += '<p>Great job staying on top of your commitments today.</p>';
                html += '</div>';
            }
        }
        
        container.innerHTML = html;
    },

    /**
     * Toggle obligation completion
     */
    toggleObligation(index) {
        const today = Utils.getTodayString();
        const commitment = StorageManager.getCommitments(today);
        
        if (commitment && commitment.obligations && commitment.obligations[index]) {
            commitment.obligations[index].completed = !commitment.obligations[index].completed;
            StorageManager.saveCommitments(today, commitment);
            
            // Re-render the view
            this.renderObligationsView();
            
            // Show feedback
            if (commitment.obligations[index].completed) {
                Utils.showSuccess('Obligation completed! 🎉');
            } else {
                Utils.showInfo('Obligation marked as incomplete');
            }
        }
    },

    /**
     * Render tasks view
     */
    renderTasksView() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="view-header">
                <h1>✓ Tasks</h1>
                <button class="btn btn-primary" onclick="TaskManager.showCreateTaskModal()">
                    + New Task
                </button>
            </div>
            
            <div class="view-filters">
                <button class="filter-btn active" onclick="App.filterTasks('all')">All</button>
                <button class="filter-btn" onclick="App.filterTasks('today')">Today</button>
                <button class="filter-btn" onclick="App.filterTasks('pending')">Pending</button>
                <button class="filter-btn" onclick="App.filterTasks('completed')">Completed</button>
            </div>
            
            <div id="tasks-container" class="items-container"></div>
        `;
        
        TaskManager.renderTaskList('tasks-container', { completed: false });
    },

    /**
     * Filter tasks
     */
    filterTasks(filter) {
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        // Apply filter
        let filterObj = {};
        switch (filter) {
            case 'today':
                filterObj = { date: Utils.getTodayString(), completed: false };
                break;
            case 'pending':
                filterObj = { completed: false };
                break;
            case 'completed':
                filterObj = { completed: true };
                break;
            default:
                filterObj = {};
        }

        TaskManager.renderTaskList('tasks-container', filterObj);
    },

    /**
     * Render habits view
     */
    renderHabitsView() {
        const container = document.getElementById('main-content');
        const stats = HabitManager.getStats();
        
        container.innerHTML = `
            <div class="view-header">
                <h1>🔄 Habits</h1>
                <button class="btn btn-primary" onclick="HabitManager.showCreateHabitModal()">
                    + New Habit
                </button>
            </div>
            
            <div class="stats-bar">
                <div class="stat-item">
                    <span class="stat-label">Today:</span>
                    <span class="stat-value">${stats.todayCompleted}/${stats.todayTotal}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Completion:</span>
                    <span class="stat-value">${stats.completionRate}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Avg Streak:</span>
                    <span class="stat-value">${stats.averageStreak} days</span>
                </div>
            </div>
            
            <div id="habits-container" class="items-container"></div>
        `;
        
        HabitManager.renderHabitList('habits-container');
    },

    /**
     * Render goals view
     */
    renderGoalsView() {
        const container = document.getElementById('main-content');
        const stats = GoalManager.getStats();
        
        container.innerHTML = `
            <div class="view-header">
                <h1>🎯 Goals</h1>
                <button class="btn btn-primary" onclick="GoalManager.showCreateGoalModal()">
                    + New Goal
                </button>
            </div>
            
            <div class="stats-bar">
                <div class="stat-item">
                    <span class="stat-label">Active:</span>
                    <span class="stat-value">${stats.active}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Completed:</span>
                    <span class="stat-value">${stats.completed}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Avg Progress:</span>
                    <span class="stat-value">${stats.averageProgress}%</span>
                </div>
            </div>
            
            <div id="goals-container" class="items-container"></div>
        `;
        
        GoalManager.renderGoalList('goals-container');
    },

    /**
     * Render time tracking view
     */
    renderTimeView() {
        const container = document.getElementById('main-content');
        const stats = TimeTracker.getStats('today');
        const activeTimer = TimeTracker.activeTimer;
        
        container.innerHTML = `
            <div class="view-header">
                <h1>⏱️ Time Tracker</h1>
                <button class="btn btn-primary" onclick="TimeTracker.showCreateEntryModal()">
                    + Add Entry
                </button>
            </div>
            
            <div class="timer-widget">
                ${activeTimer ? `
                    <div class="active-timer">
                        <div class="timer-info">
                            <span class="timer-activity">${Utils.escapeHtml(activeTimer.activity)}</span>
                            <span class="timer-category">${activeTimer.category}</span>
                        </div>
                        <div class="timer-display" id="timer-display">00:00:00</div>
                        <div class="timer-actions">
                            <button class="btn btn-danger" onclick="TimeTracker.stopTimer(); App.refreshCurrentView();">
                                Stop Timer
                            </button>
                            <button class="btn btn-secondary" onclick="TimeTracker.cancelTimer(); App.refreshCurrentView();">
                                Cancel
                            </button>
                        </div>
                    </div>
                ` : `
                    <div class="start-timer">
                        <input type="text" id="timer-activity" class="input-text" placeholder="What are you working on?">
                        <select id="timer-category" class="input-select">
                            <option value="work">Work</option>
                            <option value="personal">Personal</option>
                            <option value="learning">Learning</option>
                            <option value="exercise">Exercise</option>
                            <option value="other">Other</option>
                        </select>
                        <button class="btn btn-primary" onclick="App.startTimer()">
                            Start Timer
                        </button>
                    </div>
                `}
            </div>
            
            <div class="stats-bar">
                <div class="stat-item">
                    <span class="stat-label">Today:</span>
                    <span class="stat-value">${stats.totalHours}h</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Entries:</span>
                    <span class="stat-value">${stats.entriesCount}</span>
                </div>
            </div>
            
            <h2>Today's Entries</h2>
            <div id="time-entries-container" class="items-container"></div>
        `;
        
        TimeTracker.renderEntriesList('time-entries-container');
        this.updateTimerDisplay();
    },

    /**
     * Start timer
     */
    startTimer() {
        const activity = document.getElementById('timer-activity').value.trim();
        const category = document.getElementById('timer-category').value;
        
        if (!activity) {
            Utils.showError('Please enter an activity');
            return;
        }
        
        TimeTracker.startTimer(activity, category);
        this.refreshCurrentView();
    },

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        const display = document.getElementById('timer-display');
        if (!display || !TimeTracker.activeTimer) return;

        const duration = TimeTracker.getActiveTimerDuration();
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const seconds = Math.floor((Date.now() - new Date(TimeTracker.activeTimer.startTime)) / 1000) % 60;
        
        display.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },

    /**
     * Render screentime view
     */
    renderScreentimeView() {
        const container = document.getElementById('main-content');
        const todayEntry = ScreentimeTracker.getTodayEntry();
        const analysis = ScreentimeTracker.analyzePatterns(30);
        const stats = ScreentimeTracker.getStats(7);
        const dailyGoal = 90; // 1.5 hours in minutes
        const todayMinutes = todayEntry ? todayEntry.totalMinutes : 0;
        const isOverGoal = todayMinutes > dailyGoal;
        const remainingMinutes = Math.max(0, dailyGoal - todayMinutes);
        
        // Initialize temp apps from today's entry if it exists
        if (todayEntry && todayEntry.notes && this.tempScreentimeApps.length === 0) {
            // Try to parse existing apps from notes
            const appMatches = todayEntry.notes.match(/([^,]+)\s*\((\d+)h\s*(\d+)m\)/g);
            if (appMatches) {
                this.tempScreentimeApps = appMatches.map(match => {
                    const parts = match.match(/([^,]+)\s*\((\d+)h\s*(\d+)m\)/);
                    const name = parts[1].trim();
                    const hours = parseInt(parts[2]);
                    const minutes = parseInt(parts[3]);
                    return {
                        name: name,
                        minutes: (hours * 60) + minutes
                    };
                });
            }
        }
        
        container.innerHTML = `
            <div class="view-header">
                <h1>📱 Social Media & Games Tracker</h1>
                <div class="daily-goal-badge ${isOverGoal ? 'over-goal' : 'under-goal'}">
                    Goal: 1.5h/day
                </div>
            </div>
            
            <!-- Today's Status -->
            <div class="screentime-status-card ${isOverGoal ? 'status-warning' : 'status-good'}">
                <div class="status-main">
                    <div class="status-time">
                        ${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m
                    </div>
                    <div class="status-label">Today's Usage</div>
                </div>
                <div class="status-info">
                    ${isOverGoal ? `
                        <div class="status-message warning">
                            ⚠️ Over goal by ${Math.floor((todayMinutes - dailyGoal) / 60)}h ${(todayMinutes - dailyGoal) % 60}m
                        </div>
                    ` : `
                        <div class="status-message success">
                            ✅ ${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m remaining
                        </div>
                    `}
                    <div class="progress-bar-large">
                        <div class="progress-fill ${isOverGoal ? 'over-limit' : ''}"
                             style="width: ${Math.min(100, (todayMinutes / dailyGoal) * 100)}%"></div>
                    </div>
                </div>
            </div>
            
            <!-- App-by-App Entry -->
            <div class="screentime-entry-card">
                <h2>Log Apps Individually</h2>
                <p class="help-text">Add each social media app and game separately from your Apple Screen Time</p>
                
                <div class="add-app-form">
                    <h3>Add App</h3>
                    <div class="form-row">
                        <div class="form-group" style="flex: 2;">
                            <label for="app-name-input">App Name</label>
                            <input type="text" id="app-name-input" class="input-text"
                                   placeholder="e.g., Instagram, TikTok, Candy Crush...">
                        </div>
                        <div class="form-group">
                            <label for="app-hours-input">Hours</label>
                            <input type="number" id="app-hours-input" class="input-number"
                                   min="0" max="24" value="0">
                        </div>
                        <div class="form-group">
                            <label for="app-minutes-input">Minutes</label>
                            <input type="number" id="app-minutes-input" class="input-number"
                                   min="0" max="59" value="0">
                        </div>
                    </div>
                    <button type="button" class="btn btn-secondary" onclick="App.addScreentimeApp()">
                        + Add App
                    </button>
                </div>
                
                <!-- Today's Apps List -->
                <div id="today-apps-list"></div>
                
                <button type="button" class="btn btn-primary" onclick="App.saveScreentimeApps()" style="margin-top: 1rem;">
                    Save All Apps
                </button>
            </div>
            
            <!-- Stats Overview -->
            <div class="stats-bar">
                <div class="stat-item">
                    <span class="stat-label">7-Day Average:</span>
                    <span class="stat-value">${(stats.average / 60).toFixed(1)}h</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Trend:</span>
                    <span class="stat-value">${this.getTrendIcon(stats.trend)} ${stats.trend}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Days Logged:</span>
                    <span class="stat-value">${stats.daysLogged}/${stats.totalDays}</span>
                </div>
            </div>
            
            ${analysis.hasEnoughData ? `
                <!-- Pattern Analysis -->
                <div class="screentime-analysis">
                    <h2>📊 Pattern Analysis</h2>
                    
                    <div class="patterns-grid">
                        ${analysis.patterns.map(pattern => `
                            <div class="pattern-card pattern-${pattern.type}">
                                <h3>${pattern.title}</h3>
                                <p>${pattern.description}</p>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${analysis.recommendations.length > 0 ? `
                        <div class="recommendations-card">
                            <h3>💡 Recommendations</h3>
                            <ul class="recommendations-list">
                                ${analysis.recommendations.map(rec => `
                                    <li>${rec}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${analysis.insights.length > 0 ? `
                        <div class="insights-card">
                            <h3>🔍 Insights</h3>
                            <ul class="insights-list">
                                ${analysis.insights.map(insight => `
                                    <li>${insight}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Recent History -->
                <div class="screentime-history">
                    <h2>📅 Recent History</h2>
                    <div class="history-list">
                        ${stats.entries.reverse().map(entry => `
                            <div class="history-item">
                                <div class="history-date">${Utils.formatDate(entry.date)}</div>
                                <div class="history-time">${Math.floor(entry.totalMinutes / 60)}h ${entry.totalMinutes % 60}m</div>
                                ${entry.notes ? `<div class="history-notes">${Utils.escapeHtml(entry.notes)}</div>` : ''}
                                <button class="btn-icon" onclick="App.deleteScreentimeEntry('${entry.date}')" title="Delete">
                                    🗑️
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : `
                <div class="empty-state">
                    <p>📊 Not enough data for pattern analysis</p>
                    <p>Log at least 7 days of screentime to see patterns and insights</p>
                </div>
            `}
        `;
        
        // Render the apps list after the HTML is inserted
        setTimeout(() => this.renderTodayAppsList(), 0);
    },

    /**
     * Get trend icon
     */
    getTrendIcon(trend) {
        switch(trend) {
            case 'increasing': return '📈';
            case 'decreasing': return '📉';
            case 'stable': return '➡️';
            default: return '❓';
        }
    },

    /**
     * Temporary storage for apps being added
     */
    tempScreentimeApps: [],

    /**
     * Add app to temporary list
     */
    addScreentimeApp() {
        const name = document.getElementById('app-name-input').value.trim();
        const hours = parseInt(document.getElementById('app-hours-input').value) || 0;
        const minutes = parseInt(document.getElementById('app-minutes-input').value) || 0;
        
        if (!name) {
            Utils.showError('Please enter an app name');
            return;
        }
        
        if (hours === 0 && minutes === 0) {
            Utils.showError('Please enter time for this app');
            return;
        }
        
        const totalMinutes = (hours * 60) + minutes;
        
        this.tempScreentimeApps.push({
            name: name,
            minutes: totalMinutes
        });
        
        // Clear form
        document.getElementById('app-name-input').value = '';
        document.getElementById('app-hours-input').value = '0';
        document.getElementById('app-minutes-input').value = '0';
        
        // Re-render apps list
        this.renderTodayAppsList();
        
        Utils.showSuccess(`Added ${name}`);
    },

    /**
     * Remove app from temporary list
     */
    removeScreentimeApp(index) {
        this.tempScreentimeApps.splice(index, 1);
        this.renderTodayAppsList();
    },

    /**
     * Render today's apps list
     */
    renderTodayAppsList() {
        const container = document.getElementById('today-apps-list');
        if (!container) return;
        
        if (this.tempScreentimeApps.length === 0) {
            container.innerHTML = `
                <div class="empty-apps">
                    <p>No apps added yet. Add your social media and games above.</p>
                </div>
            `;
            return;
        }
        
        const totalMinutes = this.tempScreentimeApps.reduce((sum, app) => sum + app.minutes, 0);
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        
        container.innerHTML = `
            <div class="apps-list">
                <h3>Today's Apps (${totalHours}h ${remainingMinutes}m total)</h3>
                ${this.tempScreentimeApps.map((app, index) => `
                    <div class="app-item">
                        <div class="app-info">
                            <span class="app-name">${Utils.escapeHtml(app.name)}</span>
                            <span class="app-time">${Math.floor(app.minutes / 60)}h ${app.minutes % 60}m</span>
                        </div>
                        <button type="button" class="btn-icon" onclick="App.removeScreentimeApp(${index})">
                            🗑️
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Save all screentime apps
     */
    saveScreentimeApps() {
        if (this.tempScreentimeApps.length === 0) {
            Utils.showError('Please add at least one app');
            return;
        }
        
        const totalMinutes = this.tempScreentimeApps.reduce((sum, app) => sum + app.minutes, 0);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const appsList = this.tempScreentimeApps.map(app =>
            `${app.name} (${Math.floor(app.minutes / 60)}h ${app.minutes % 60}m)`
        ).join(', ');
        
        ScreentimeTracker.addEntry(Utils.getTodayString(), hours, minutes, appsList);
        
        // Clear temporary apps
        this.tempScreentimeApps = [];
        
        this.refreshCurrentView();
    },

    /**
     * Handle screentime entry (legacy method, kept for compatibility)
     */
    handleScreentimeEntry(event) {
        event.preventDefault();
        
        const hours = parseInt(document.getElementById('screentime-hours').value) || 0;
        const minutes = parseInt(document.getElementById('screentime-minutes').value) || 0;
        const notes = document.getElementById('screentime-notes').value.trim();
        
        if (hours === 0 && minutes === 0) {
            Utils.showError('Please enter a valid screentime');
            return;
        }
        
        ScreentimeTracker.addEntry(Utils.getTodayString(), hours, minutes, notes);
        this.refreshCurrentView();
    },

    /**
     * Delete screentime entry
     */
    deleteScreentimeEntry(date) {
        if (confirm('Delete this screentime entry?')) {
            ScreentimeTracker.deleteEntry(date);
            this.refreshCurrentView();
        }
    },

    /**
     * Render history view
     */
    renderHistoryView() {
        const container = document.getElementById('main-content');
        const allCommitments = StorageManager.getAllCommitments();
        const dates = Object.keys(allCommitments).sort().reverse();
        
        container.innerHTML = `
            <div class="view-header">
                <h1>📅 History</h1>
                <p class="subtitle">Browse your previous days and accountability records</p>
            </div>
            
            <div class="history-calendar">
                ${dates.length > 0 ? dates.map(date => {
                    const commitment = allCommitments[date];
                    const screentimeEntry = ScreentimeTracker.getEntry(date);
                    const wakeupMet = commitment.wakeup?.met;
                    const hasData = commitment.wakeup?.actual || screentimeEntry;
                    
                    return `
                        <div class="history-day-card ${hasData ? 'has-data' : 'no-data'}"
                             onclick="App.showDayDetail('${date}')">
                            <div class="day-header">
                                <div class="day-date">
                                    <div class="day-weekday">${new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                    <div class="day-number">${new Date(date).getDate()}</div>
                                    <div class="day-month">${new Date(date).toLocaleDateString('en-US', { month: 'short' })}</div>
                                </div>
                                <div class="day-status">
                                    ${wakeupMet === true ? '✅' : wakeupMet === false ? '❌' : '⏳'}
                                </div>
                            </div>
                            <div class="day-summary">
                                ${commitment.wakeup?.actual ? `
                                    <div class="summary-item">
                                        <span class="summary-icon">⏰</span>
                                        <span class="summary-text">Woke at ${Utils.formatTimeString(commitment.wakeup.actual)}</span>
                                    </div>
                                ` : ''}
                                ${screentimeEntry ? `
                                    <div class="summary-item">
                                        <span class="summary-icon">📱</span>
                                        <span class="summary-text">${Math.floor(screentimeEntry.totalMinutes / 60)}h ${screentimeEntry.totalMinutes % 60}m screentime</span>
                                    </div>
                                ` : ''}
                                ${!hasData ? '<p class="no-data-text">No data logged</p>' : ''}
                            </div>
                        </div>
                    `;
                }).join('') : `
                    <div class="empty-state">
                        <p>No history yet!</p>
                        <p>Complete your daily check-ins to build your history.</p>
                    </div>
                `}
            </div>
        `;
    },

    /**
     * Show detailed view for a specific day
     */
    showDayDetail(date) {
        const container = document.getElementById('main-content');
        const commitment = StorageManager.getCommitments(date);
        const screentimeEntry = ScreentimeTracker.getEntry(date);
        const timeEntries = TimeTracker.timeEntries.filter(entry => {
            const entryDate = Utils.getDateString(new Date(entry.startTime));
            return entryDate === date;
        });
        
        const dateObj = new Date(date);
        const formattedDate = Utils.formatDate(dateObj, 'long');
        
        container.innerHTML = `
            <div class="view-header">
                <button class="btn btn-secondary" onclick="App.showView('history')">
                    ← Back to History
                </button>
                <h1>📅 ${formattedDate}</h1>
            </div>
            
            <div class="day-detail">
                <!-- Wake-up Commitment -->
                ${commitment?.wakeup?.commitment ? `
                    <div class="detail-section">
                        <h2>⏰ Wake-up Time</h2>
                        <div class="detail-card ${commitment.wakeup.met ? 'success' : 'warning'}">
                            <div class="detail-row">
                                <span class="detail-label">Committed:</span>
                                <span class="detail-value">${Utils.formatTimeString(commitment.wakeup.commitment)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Actual:</span>
                                <span class="detail-value">${commitment.wakeup.actual ? Utils.formatTimeString(commitment.wakeup.actual) : 'Not logged'}</span>
                            </div>
                            ${commitment.wakeup.minutesLate > 0 ? `
                                <div class="detail-row">
                                    <span class="detail-label">Late by:</span>
                                    <span class="detail-value warning-text">${commitment.wakeup.minutesLate} minutes</span>
                                </div>
                            ` : ''}
                            ${commitment.wakeup.excuse ? `
                                <div class="detail-row">
                                    <span class="detail-label">Excuse:</span>
                                    <span class="detail-value">${Utils.escapeHtml(commitment.wakeup.excuse)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Screentime -->
                ${screentimeEntry ? `
                    <div class="detail-section">
                        <h2>📱 Screentime</h2>
                        <div class="detail-card ${screentimeEntry.totalMinutes <= 90 ? 'success' : 'warning'}">
                            <div class="detail-row">
                                <span class="detail-label">Total:</span>
                                <span class="detail-value">${Math.floor(screentimeEntry.totalMinutes / 60)}h ${screentimeEntry.totalMinutes % 60}m</span>
                            </div>
                            ${screentimeEntry.notes ? `
                                <div class="detail-row">
                                    <span class="detail-label">Apps:</span>
                                    <span class="detail-value">${Utils.escapeHtml(screentimeEntry.notes)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Time Tracking -->
                ${timeEntries.length > 0 ? `
                    <div class="detail-section">
                        <h2>⏱️ Time Tracked</h2>
                        <div class="time-entries-list">
                            ${timeEntries.map(entry => `
                                <div class="time-entry-item">
                                    <div class="entry-activity">${Utils.escapeHtml(entry.activity)}</div>
                                    <div class="entry-meta">
                                        <span class="entry-category">${entry.category}</span>
                                        <span class="entry-duration">${Math.floor(entry.duration / 60)}h ${entry.duration % 60}m</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Reflections -->
                ${(() => {
                    const reflections = ReflectionManager.getReflectionsByDate(date);
                    return reflections.length > 0 ? `
                        <div class="detail-section">
                            <h2>💭 Reflections</h2>
                            ${reflections.map(reflection => `
                                <div class="detail-card">
                                    <div class="reflection-content">${Utils.escapeHtml(reflection.content)}</div>
                                    <div class="reflection-footer">
                                        <span class="reflection-time">${Utils.formatTime(reflection.createdAt)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '';
                })()}
                
                ${!commitment && !screentimeEntry && timeEntries.length === 0 && ReflectionManager.getReflectionsByDate(date).length === 0 ? `
                    <div class="empty-state">
                        <p>No data logged for this day</p>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Render reflections view
     */
    renderReflectionsView() {
        const container = document.getElementById('main-content');
        const stats = ReflectionManager.getStats();
        const allReflections = ReflectionManager.getAllReflections();
        
        container.innerHTML = `
            <div class="view-header">
                <h1>💭 Reflections</h1>
                <p class="subtitle">Journal your thoughts and track your journey</p>
            </div>
            
            <!-- Stats Bar -->
            <div class="stats-bar">
                <div class="stat-item">
                    <span class="stat-label">Total Reflections:</span>
                    <span class="stat-value">${stats.total}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Days with Reflections:</span>
                    <span class="stat-value">${stats.daysWithReflections}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Current Streak:</span>
                    <span class="stat-value">${stats.currentStreak} days</span>
                </div>
            </div>
            
            <!-- New Reflection Form -->
            <div class="reflection-form-card">
                <h2>✍️ Write a Reflection</h2>
                <form id="reflection-form" onsubmit="App.handleReflectionSubmit(event)">
                    <div class="form-group">
                        <label for="reflection-content">What's on your mind?</label>
                        <textarea id="reflection-content" class="input-textarea"
                                  rows="6" placeholder="Write your thoughts, feelings, lessons learned, or anything you want to remember about today..."
                                  required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Save Reflection</button>
                </form>
            </div>
            
            <!-- Reflections List -->
            <div class="reflections-list">
                <h2>📖 Your Reflections</h2>
                ${allReflections.length > 0 ? `
                    <div class="reflections-grid">
                        ${allReflections.map(reflection => `
                            <div class="reflection-card">
                                <div class="reflection-header">
                                    <div class="reflection-date">
                                        ${Utils.formatDate(reflection.date, 'long')}
                                    </div>
                                    <button class="btn-icon" onclick="App.deleteReflection('${reflection.id}')" title="Delete">
                                        🗑️
                                    </button>
                                </div>
                                <div class="reflection-content">
                                    ${Utils.escapeHtml(reflection.content)}
                                </div>
                                <div class="reflection-footer">
                                    <span class="reflection-time">${Utils.formatTime(reflection.createdAt)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <p>No reflections yet</p>
                        <p>Start writing to track your thoughts and progress</p>
                    </div>
                `}
            </div>
        `;
    },

    /**
     * Handle reflection form submission
     */
    handleReflectionSubmit(event) {
        event.preventDefault();
        
        const content = document.getElementById('reflection-content').value.trim();
        
        if (!content) {
            Utils.showError('Please write something');
            return;
        }
        
        ReflectionManager.addReflection(content);
        this.refreshCurrentView();
    },

    /**
     * Delete reflection
     */
    deleteReflection(id) {
        if (confirm('Delete this reflection?')) {
            ReflectionManager.deleteReflection(id);
            this.refreshCurrentView();
        }
    },

    /**
     * Update header
     */
    updateHeader() {
        try {
            const dateElement = document.getElementById('current-date');
            const streakElement = document.getElementById('streak-indicator');
            
            if (dateElement) {
                dateElement.textContent = Utils.formatDate(new Date(), 'long');
            }
            
            if (streakElement) {
                const stats = CommitmentTracker.getStats();
                streakElement.textContent = `🔥 ${stats.currentStreak}`;
            }
        } catch (error) {
            console.error('Error updating header:', error);
        }
    },

    /**
     * Refresh current view
     */
    refreshCurrentView() {
        this.showView(this.currentView);
        this.updateHeader();
    },

    /**
     * Show loading screen
     */
    showLoading() {
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    },

    /**
     * Hide loading screen
     */
    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'block';
    },

    /**
     * Show error
     */
    showError(message) {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.innerHTML = `
            <div class="error-message">
                <h2>⚠️ Error</h2>
                <p>${Utils.escapeHtml(message)}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    Reload App
                </button>
            </div>
        `;
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Make App available globally
window.App = App;

// Made with Bob