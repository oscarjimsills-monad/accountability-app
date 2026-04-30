/**
 * Dashboard Module
 * Handles dashboard view and analytics
 */

const Dashboard = {
    /**
     * Render dashboard
     */
    render() {
        const container = document.getElementById('main-content');
        if (!container) {
            console.error('Main content container not found');
            return;
        }

        const stats = this.getOverallStats();
        const commitmentStats = CommitmentTracker.getStats();
        const todayCommitment = CommitmentTracker.getTodayCommitment();
        const timeDistribution = this.getTimeDistribution();

        container.innerHTML = `
            <div class="dashboard">
                <div class="dashboard-header">
                    <h1>Dashboard</h1>
                    <p class="dashboard-date">${Utils.formatDate(new Date(), 'long')}</p>
                </div>

                <!-- Streaks Overview -->
                <div class="dashboard-section">
                    <h2>🔥 Streaks</h2>
                    ${this.renderStreaksGrid()}
                </div>

                <!-- Accountability Overview -->
                <div class="dashboard-section">
                    <h2>📊 Accountability Stats</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">📈</div>
                            <div class="stat-content">
                                <div class="stat-value">${commitmentStats.weeklyScore}%</div>
                                <div class="stat-label">This Week</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🎯</div>
                            <div class="stat-content">
                                <div class="stat-value">${commitmentStats.wakeupRate}%</div>
                                <div class="stat-label">All-Time Rate</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Today's Overview -->
                <div class="dashboard-section">
                    <h2>📅 Today</h2>
                    <div class="today-grid">
                        ${this.renderTodayTasks(stats.tasks)}
                        ${this.renderTodayHabits(stats.habits)}
                    </div>
                </div>

                <!-- Time Distribution (Today) -->
                ${timeDistribution.hasData ? `
                    <div class="dashboard-section">
                        <h2>⏰ Today's Time Distribution</h2>
                        <div class="time-distribution-container">
                            <div class="pie-chart-container">
                                ${this.renderPieChart(timeDistribution.data)}
                            </div>
                            <div class="time-legend">
                                ${timeDistribution.data.map(item => `
                                    <div class="legend-item">
                                        <span class="legend-color" style="background: ${item.color}"></span>
                                        <span class="legend-label">${item.category}</span>
                                        <span class="legend-value">${item.hours}h ${item.minutes}m</span>
                                        <span class="legend-percent">(${item.percentage}%)</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                ` : ''}

                <!-- Quick Stats -->
                <div class="dashboard-section">
                    <h2>📊 Quick Stats</h2>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">✓</div>
                            <div class="stat-content">
                                <div class="stat-value">${stats.tasks.pending}</div>
                                <div class="stat-label">Pending Tasks</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🔄</div>
                            <div class="stat-content">
                                <div class="stat-value">${stats.habits.todayRemaining}</div>
                                <div class="stat-label">Habits Left</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">🎯</div>
                            <div class="stat-content">
                                <div class="stat-value">${stats.goals.active}</div>
                                <div class="stat-label">Active Goals</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">⏱️</div>
                            <div class="stat-content">
                                <div class="stat-value">${stats.time.todayHours}h</div>
                                <div class="stat-label">Tracked Today</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="dashboard-section">
                    <h2>📋 Recent Activity</h2>
                    ${this.renderRecentActivity()}
                </div>

                <!-- Commitments for Tomorrow -->
                ${todayCommitment ? this.renderTomorrowCommitments(todayCommitment) : ''}
            </div>
        `;
    },

    /**
     * Get overall statistics
     */
    getOverallStats() {
        return {
            tasks: TaskManager.getStats(),
            habits: HabitManager.getStats(),
            goals: GoalManager.getStats(),
            time: TimeTracker.getStats('today'),
            commitments: CommitmentTracker.getStats()
        };
    },

    /**
     * Render today's tasks section
     */
    renderTodayTasks(taskStats) {
        const todayTasks = TaskManager.getTodayTasks();
        const overdueTasks = TaskManager.getOverdueTasks();

        return `
            <div class="today-card">
                <div class="today-card-header">
                    <h3>✓ Tasks</h3>
                    <span class="badge">${todayTasks.length}</span>
                </div>
                <div class="today-card-body">
                    ${todayTasks.length > 0 ? `
                        <ul class="quick-list">
                            ${todayTasks.slice(0, 5).map(task => `
                                <li>
                                    <input type="checkbox" 
                                           onchange="TaskManager.toggleTask('${task.id}'); Dashboard.render();">
                                    <span>${Utils.escapeHtml(task.title)}</span>
                                </li>
                            `).join('')}
                        </ul>
                        ${todayTasks.length > 5 ? `<p class="more-text">+${todayTasks.length - 5} more</p>` : ''}
                    ` : '<p class="empty-text">No tasks for today</p>'}
                    ${overdueTasks.length > 0 ? `
                        <p class="warning-text">⚠️ ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}</p>
                    ` : ''}
                </div>
                <div class="today-card-footer">
                    <a href="#" onclick="App.showView('tasks'); return false;">View all →</a>
                </div>
            </div>
        `;
    },

    /**
     * Render today's habits section
     */
    renderTodayHabits(habitStats) {
        const todayHabits = HabitManager.getTodayHabits();
        const today = Utils.getTodayString();

        return `
            <div class="today-card">
                <div class="today-card-header">
                    <h3>🔄 Habits</h3>
                    <span class="badge">${habitStats.todayCompleted}/${habitStats.todayTotal}</span>
                </div>
                <div class="today-card-body">
                    ${todayHabits.length > 0 ? `
                        <ul class="quick-list">
                            ${todayHabits.slice(0, 5).map(habit => {
                                const completed = habit.completions.includes(today);
                                return `
                                    <li class="${completed ? 'completed' : ''}">
                                        <input type="checkbox" 
                                               ${completed ? 'checked' : ''}
                                               onchange="HabitManager.toggleHabit('${habit.id}'); Dashboard.render();">
                                        <span>${Utils.escapeHtml(habit.name)}</span>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                        ${todayHabits.length > 5 ? `<p class="more-text">+${todayHabits.length - 5} more</p>` : ''}
                    ` : '<p class="empty-text">No habits for today</p>'}
                    ${habitStats.completionRate > 0 ? `
                        <div class="progress-bar-small">
                            <div class="progress-fill" style="width: ${habitStats.completionRate}%"></div>
                        </div>
                    ` : ''}
                </div>
                <div class="today-card-footer">
                    <a href="#" onclick="App.showView('habits'); return false;">View all →</a>
                </div>
            </div>
        `;
    },

    /**
     * Render recent activity
     */
    renderRecentActivity() {
        const activities = [];

        // Recent completed tasks
        const recentTasks = TaskManager.getTasks({ completed: true })
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
            .slice(0, 3);
        
        recentTasks.forEach(task => {
            activities.push({
                type: 'task',
                icon: '✓',
                text: `Completed task: ${task.title}`,
                time: task.completedAt
            });
        });

        // Recent habit completions
        const today = Utils.getTodayString();
        const completedHabits = HabitManager.getActiveHabits()
            .filter(h => h.completions.includes(today))
            .slice(0, 3);
        
        completedHabits.forEach(habit => {
            activities.push({
                type: 'habit',
                icon: '🔄',
                text: `Completed habit: ${habit.name}`,
                time: new Date().toISOString()
            });
        });

        // Sort by time
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));

        if (activities.length === 0) {
            return '<p class="empty-text">No recent activity</p>';
        }

        return `
            <ul class="activity-list">
                ${activities.slice(0, 10).map(activity => `
                    <li class="activity-item">
                        <span class="activity-icon">${activity.icon}</span>
                        <span class="activity-text">${Utils.escapeHtml(activity.text)}</span>
                        <span class="activity-time">${this.getRelativeTime(activity.time)}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    },

    /**
     * Render tomorrow's commitments
     */
    renderTomorrowCommitments(commitment) {
        if (!commitment.wakeup?.commitment) return '';

        return `
            <div class="dashboard-section commitment-preview">
                <h2>🌙 Tomorrow's Commitments</h2>
                <div class="commitment-summary">
                    <div class="commitment-item">
                        <span class="commitment-icon">⏰</span>
                        <div class="commitment-details">
                            <div class="commitment-label">Wake up at</div>
                            <div class="commitment-value">${Utils.formatTimeString(commitment.wakeup.commitment)}</div>
                        </div>
                    </div>
                    ${commitment.bedtime?.commitment ? `
                        <div class="commitment-item">
                            <span class="commitment-icon">🛏️</span>
                            <div class="commitment-details">
                                <div class="commitment-label">Bedtime</div>
                                <div class="commitment-value">${Utils.formatTimeString(commitment.bedtime.commitment)}</div>
                            </div>
                        </div>
                    ` : ''}
                    ${commitment.obligations?.length > 0 ? `
                        <div class="commitment-item">
                            <span class="commitment-icon">📋</span>
                            <div class="commitment-details">
                                <div class="commitment-label">Obligations</div>
                                <div class="commitment-value">${commitment.obligations.length} scheduled</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Get relative time string
     */
    getRelativeTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return Utils.formatDate(time);
    },

    /**
     * Get time distribution for current day (today only)
     */
    getTimeDistribution() {
        const today = Utils.getTodayString();
        const data = [];
        let totalMinutes = 0;
        
        // Color palette for different activities
        const colors = [
            '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
            '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
        ];
        let colorIndex = 0;
        
        // 1. Add time-tracked activities (by specific activity name, not category)
        const todayEntries = TimeTracker.timeEntries.filter(entry => {
            const entryDate = Utils.getDateString(new Date(entry.startTime));
            return entryDate === today;
        });
        
        todayEntries.forEach(entry => {
            const existingActivity = data.find(d => d.name === entry.activity);
            if (existingActivity) {
                existingActivity.totalMinutes += entry.duration;
            } else {
                data.push({
                    name: entry.activity,
                    totalMinutes: entry.duration,
                    color: colors[colorIndex % colors.length]
                });
                colorIndex++;
            }
            totalMinutes += entry.duration;
        });
        
        // 2. Add screentime (social media & games)
        const screentimeEntry = ScreentimeTracker.getTodayEntry();
        if (screentimeEntry && screentimeEntry.totalMinutes > 0) {
            data.push({
                name: 'Social Media & Games',
                totalMinutes: screentimeEntry.totalMinutes,
                color: '#ef4444' // Red for screentime
            });
            totalMinutes += screentimeEntry.totalMinutes;
        }
        
        // 3. Calculate sleep time from commitments
        const todayCommitment = CommitmentTracker.getTodayCommitment();
        const yesterdayCommitment = CommitmentTracker.getYesterdayCommitment();
        
        if (todayCommitment?.wakeup?.actual && yesterdayCommitment?.bedtime?.actual) {
            // Calculate sleep from yesterday's bedtime to today's wake-up
            const bedtime = yesterdayCommitment.bedtime.actual;
            const wakeup = todayCommitment.wakeup.actual;
            
            const sleepMinutes = this.calculateSleepDuration(bedtime, wakeup);
            if (sleepMinutes > 0) {
                data.push({
                    name: 'Sleep',
                    totalMinutes: sleepMinutes,
                    color: '#6366f1' // Indigo for sleep
                });
                totalMinutes += sleepMinutes;
            }
        }
        
        // 4. Calculate time left today (until midnight)
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const minutesUntilMidnight = Math.floor((midnight - now) / (1000 * 60));
        
        // 5. Calculate untracked time (time that has passed but wasn't logged)
        const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
        const trackedMinutes = totalMinutes; // Everything tracked so far
        const untrackedMinutes = Math.max(0, minutesSinceMidnight - trackedMinutes);
        
        // Add untracked time (past time not accounted for)
        if (untrackedMinutes > 0) {
            data.push({
                name: 'Untracked Time',
                totalMinutes: untrackedMinutes,
                color: '#9ca3af' // Gray for untracked past time
            });
            totalMinutes += untrackedMinutes;
        }
        
        // Add time left today (future time - golden opportunity!)
        if (minutesUntilMidnight > 0) {
            data.push({
                name: 'Time Left Today',
                totalMinutes: minutesUntilMidnight,
                color: '#f59e0b' // Golden/amber for valuable remaining time
            });
            totalMinutes += minutesUntilMidnight;
        }
        
        if (data.length === 0) {
            return { hasData: false };
        }
        
        // Calculate percentages and format
        const formattedData = data.map(item => ({
            category: item.name,
            minutes: item.totalMinutes % 60,
            hours: Math.floor(item.totalMinutes / 60),
            totalMinutes: item.totalMinutes,
            percentage: Math.round((item.totalMinutes / totalMinutes) * 100),
            color: item.color
        })).sort((a, b) => b.totalMinutes - a.totalMinutes);

        return { hasData: true, data: formattedData, totalMinutes };
    },
    
    /**
     * Calculate sleep duration between bedtime and wake-up
     */
    calculateSleepDuration(bedtime, wakeup) {
        // Parse time strings (HH:MM format)
        const [bedHour, bedMin] = bedtime.split(':').map(Number);
        const [wakeHour, wakeMin] = wakeup.split(':').map(Number);
        
        // Convert to minutes from midnight
        let bedMinutes = bedHour * 60 + bedMin;
        let wakeMinutes = wakeHour * 60 + wakeMin;
        
        // If bedtime is late (e.g., 23:00), it's actually the previous day
        // If wake time is early (e.g., 07:00), it's the next day
        if (bedMinutes > wakeMinutes) {
            // Sleep crosses midnight
            wakeMinutes += 24 * 60;
        }
        
        return wakeMinutes - bedMinutes;
    },

    /**
     * Render CSS-based pie chart
     */
    renderPieChart(data) {
        let cumulativePercent = 0;
        const segments = data.map(item => {
            const startPercent = cumulativePercent;
            cumulativePercent += item.percentage;
            return {
                ...item,
                startPercent,
                endPercent: cumulativePercent
            };
        });

        // Create conic gradient
        const gradientStops = segments.map(seg =>
            `${seg.color} ${seg.startPercent}% ${seg.endPercent}%`
        ).join(', ');

        return `
            <div class="pie-chart" style="background: conic-gradient(${gradientStops})">
                <div class="pie-chart-center">
                    <div class="pie-chart-total">${Math.round(data.reduce((sum, d) => sum + d.totalMinutes, 0) / 60)}h</div>
                    <div class="pie-chart-label">Total</div>
                </div>
            </div>
        `;
    },

    /**
     * Render streaks grid
     */
    renderStreaksGrid() {
        const wakeupStreak = CommitmentTracker.calculateWakeupStreak();
        const screentimeStreak = ScreentimeTracker.getStreak(90); // 1.5 hours goal
        const activeHabits = HabitManager.getActiveHabits();
        
        // Get top 3 habits by current streak
        const habitStreaks = activeHabits
            .map(habit => ({
                ...habit,
                streak: HabitManager.calculateStreak(habit.id)
            }))
            .sort((a, b) => b.streak.current - a.streak.current)
            .slice(0, 3);
        
        return `
            <div class="streaks-grid">
                <!-- Wake-up Streak -->
                <div class="streak-card ${wakeupStreak.current > 0 ? 'streak-active' : ''}">
                    <div class="streak-icon">⏰</div>
                    <div class="streak-content">
                        <div class="streak-title">Wake-up Time</div>
                        <div class="streak-value">${wakeupStreak.current} days</div>
                        <div class="streak-best">Best: ${wakeupStreak.longest}</div>
                    </div>
                </div>
                
                <!-- Screentime Streak -->
                <div class="streak-card ${screentimeStreak.current > 0 ? 'streak-active' : ''}">
                    <div class="streak-icon">📱</div>
                    <div class="streak-content">
                        <div class="streak-title">Screentime Goal</div>
                        <div class="streak-value">${screentimeStreak.current} days</div>
                        <div class="streak-best">Best: ${screentimeStreak.longest}</div>
                    </div>
                </div>
                
                <!-- Top Habits -->
                ${habitStreaks.map(habit => `
                    <div class="streak-card ${habit.streak.current > 0 ? 'streak-active' : ''}">
                        <div class="streak-icon">🔄</div>
                        <div class="streak-content">
                            <div class="streak-title">${Utils.escapeHtml(habit.name)}</div>
                            <div class="streak-value">${habit.streak.current} days</div>
                            <div class="streak-best">Best: ${habit.streak.longest}</div>
                        </div>
                    </div>
                `).join('')}
                
                ${habitStreaks.length === 0 ? `
                    <div class="streak-card streak-empty">
                        <div class="streak-icon">🔄</div>
                        <div class="streak-content">
                            <div class="streak-title">No Habits Yet</div>
                            <div class="streak-subtitle">Create habits to track streaks</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Refresh dashboard
     */
    refresh() {
        this.render();
    }
};

// Make Dashboard available globally
window.Dashboard = Dashboard;

// Made with Bob