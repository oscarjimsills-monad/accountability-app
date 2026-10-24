/**
 * Dashboard Module
 * Handles dashboard view and analytics
 */

const Dashboard = {
    // Dashboard sections that can be shown or hidden from Settings → Dashboard.
    // The nightly check-in banner isn't listed: it's the way into the evening
    // check-in, so it always shows while a check-in is due.
    SECTIONS: [
        { key: 'goals',      label: "This Week's Goals",              defaultOn: true },
        { key: 'obligations',label: "Today's Obligations",            defaultOn: true },
        { key: 'priorities', label: "Today's Priorities",             defaultOn: true },
        { key: 'tasks',      label: 'Tasks',                          defaultOn: true },
        { key: 'habits',     label: 'Habits',                         defaultOn: false },
        { key: 'streaks',    label: 'Streaks',                        defaultOn: false },
        { key: 'stats',      label: 'Accountability Stats',           defaultOn: true },
        { key: 'timeToday',  label: "Today's Time Distribution",      defaultOn: true },
        { key: 'timeWeek',   label: 'Last 7 Days Time Distribution',  defaultOn: true },
        { key: 'activity',   label: 'Recent Activity',                defaultOn: true },
        { key: 'tomorrow',   label: "Tomorrow's Commitments",         defaultOn: true }
    ],

    // Long lists show only their first few items on the dashboard
    PREVIEW_COUNT: 3,

    // Which sections are collapsed / showing all their items. Deliberately kept in
    // memory only: every visit to the app starts with everything open at the preview.
    _ui: { collapsed: {}, expanded: {} },

    /** Whether a section is switched on — the user's setting, else its default. */
    isSectionVisible(key) {
        const saved = StorageManager.getSettings().dashboardSections;
        if (saved && key in saved) return !!saved[key];
        return this.SECTIONS.find(s => s.key === key)?.defaultOn ?? true;
    },

    /** Switch a section on or off (saved straight away, with the other settings). */
    setSectionVisible(key, visible) {
        const settings = StorageManager.getSettings();
        settings.dashboardSections = { ...(settings.dashboardSections || {}), [key]: !!visible };
        StorageManager.saveSettings(settings);
        Utils.showSuccess('Dashboard updated!');
    },

    /**
     * Wrap a section so tapping its header collapses it to just the header (and
     * again to open it). Only a class is toggled — nothing is re-rendered — so
     * anything typed into an add box elsewhere on the page survives.
     */
    sectionHtml(key, headingHtml, bodyHtml, extraClass = '') {
        const collapsed = !!this._ui.collapsed[key];
        return `
            <div class="dashboard-section dash-collapsible ${collapsed ? 'is-collapsed' : ''} ${extraClass}" data-section="${key}">
                <h2 class="dash-section-header" role="button" tabindex="0" aria-expanded="${!collapsed}"
                    onclick="Dashboard.toggleSection('${key}')"
                    onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); Dashboard.toggleSection('${key}'); }"
                    title="Tap to collapse or expand">
                    <span class="dash-chevron" aria-hidden="true"></span>${headingHtml}
                </h2>
                <div class="dash-section-body">${bodyHtml}</div>
            </div>
        `;
    },

    toggleSection(key) {
        const collapsed = this._ui.collapsed[key] = !this._ui.collapsed[key];
        const section = document.querySelector(`.dash-collapsible[data-section="${key}"]`);
        section?.classList.toggle('is-collapsed', collapsed);
        section?.querySelector('.dash-section-header')?.setAttribute('aria-expanded', String(!collapsed));
    },

    /**
     * The first few items of a list. When there are more, `moreHtml` is a
     * "+N more" button that opens the rest in place (and "Show less" to go
     * back) — nothing is ever unreachable from the dashboard, e.g. a fourth
     * goal that has no other page to be ticked off on.
     */
    previewItems(key, items) {
        const expanded = !!this._ui.expanded[key];
        const hidden = items.length - this.PREVIEW_COUNT;
        return {
            visible: expanded ? items : items.slice(0, this.PREVIEW_COUNT),
            moreHtml: hidden > 0
                ? `<button type="button" class="dash-more" onclick="Dashboard.toggleOverflow('${key}')">${expanded ? 'Show less' : `+${hidden} more`}</button>`
                : ''
        };
    },

    toggleOverflow(key) {
        this._ui.expanded[key] = !this._ui.expanded[key];
        this.render();
    },

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

        // Which sections appear is the user's choice (Settings → Dashboard), and
        // each one collapses to just its header when the header is tapped.
        container.innerHTML = `
            <div class="dashboard">
                <div class="dashboard-header">
                    <h1>Dashboard</h1>
                    <p class="dashboard-date">${Utils.formatDate(Utils.getLogDateString(), 'long')}</p>
                </div>

                <!-- Nightly Check-in Button (always shown while a check-in is due) -->
                ${this.renderNightlyCheckinButton()}

                ${this.renderWeeklyGoalsSection()}
                ${this.renderTodayObligations()}
                ${this.renderTodayPriorities()}
                ${this.renderTasksSection()}
                ${this.renderHabitsSection(stats.habits)}
                ${this.renderStreaksSection()}
                ${this.renderStatsSection(commitmentStats)}
                ${this.renderTimeDistributionSection('timeToday', "⏰ Today's Time Distribution", () => this.getTimeDistribution())}
                ${this.renderTimeDistributionSection('timeWeek', '📅 Last 7 Days Time Distribution', () => this.getWeeklyTimeDistribution())}
                ${this.renderActivitySection()}
                ${todayCommitment ? this.renderTomorrowCommitments(todayCommitment) : ''}
            </div>
        `;

        this.bindObligationSorting();
    },

    renderStreaksSection() {
        if (!this.isSectionVisible('streaks')) return '';
        return this.sectionHtml('streaks', '🔥 Streaks', this.renderStreaksGrid());
    },

    renderStatsSection(commitmentStats) {
        if (!this.isSectionVisible('stats')) return '';
        return this.sectionHtml('stats', '📊 Accountability Stats', `
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
        `);
    },

    renderTimeDistributionSection(key, title, getDistribution) {
        if (!this.isSectionVisible(key)) return '';
        const distribution = getDistribution();
        if (!distribution.hasData) return '';
        return this.sectionHtml(key, title, `
            <div class="time-distribution-container">
                <div class="pie-chart-container">
                    ${this.renderPieChart(distribution.data)}
                </div>
                <div class="time-legend">
                    ${distribution.data.map(item => `
                        <div class="legend-item">
                            <span class="legend-color" style="background: ${item.color}"></span>
                            <span class="legend-label">${item.category}</span>
                            <span class="legend-value">${item.hours}h ${item.minutes}m</span>
                            <span class="legend-percent">(${item.percentage}%)</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
    },

    renderActivitySection() {
        if (!this.isSectionVisible('activity')) return '';
        return this.sectionHtml('activity', '📋 Recent Activity', this.renderRecentActivity());
    },

    renderNightlyCheckinButton() {
        if (!CommitmentTracker.needsEveningCheckin()) return '';
        const today = Utils.getLogDateString(); // e.g. "2026-06-14"
        const [year, month, day] = today.split('-');
        const label = `${day}/${month}`; // DD/MM
        return `
            <div class="dashboard-section nightly-checkin-banner">
                <div class="weekly-review-prompt">
                    <div class="weekly-review-text">
                        <strong>🌙 Nightly Check-in ${label}</strong>
                        <span>Log your evening, set tomorrow's obligations and wind down.</span>
                    </div>
                    <button class="btn btn-primary" onclick="App.startEveningCheckin()">
                        Start Check-in →
                    </button>
                </div>
            </div>
        `;
    },

    renderWeeklyGoalsSection() {
        if (!this.isSectionVisible('goals')) return '';

        // The week by the app's own day boundary (a 2am Monday is still Sunday).
        // This week's goals were set at last Sunday's review, so they live on
        // that earlier entry — looking under the current week's own key (as
        // this used to) made them vanish from Monday on, so they could never
        // be ticked and always read as failed at the next review.
        const weekKey = CommitmentTracker.getWeekKey(new Date(Utils.getLogDateString() + 'T12:00:00'));
        const { storeKey, goals } = CommitmentTracker.getGoalsForWeek(weekKey);
        const { visible, moreHtml } = this.previewItems('goals', goals.map((g, i) => ({ g, i })));

        return this.sectionHtml('goals', "🎯 This Week's Goals", `
            <div class="weekly-goals-list">
                ${goals.length === 0 ? '<p class="empty-text">No goals set for this week yet</p>' : visible.map(({ g, i }) => `
                    <div class="weekly-goal-card ${g.completed ? 'completed' : ''}">
                        <input type="checkbox" ${g.completed ? 'checked' : ''}
                            onchange="Dashboard.toggleWeeklyGoal('${storeKey}', ${i}); Dashboard.render();">
                        <span>${Utils.escapeHtml(g.title)}</span>
                    </div>
                `).join('')}
            </div>
            ${moreHtml}
            <form class="add-weekly-goal" onsubmit="Dashboard.addWeeklyGoal(event, '${weekKey}')">
                <input type="text" id="new-weekly-goal" class="input-text" placeholder="Add a goal for this week...">
                <button type="submit" class="btn btn-secondary btn-sm">+ Add</button>
            </form>
        `);
    },

    renderTodayObligations() {
        if (!this.isSectionVisible('obligations')) return '';

        const today = Utils.getLogDateString();
        const commitment = StorageManager.getCommitments(today);
        const obligations = commitment?.obligations || [];

        // Shown in the order the user chose — position in the list IS the
        // importance ranking, so it is deliberately not sorted by time.
        const completed = obligations.filter(o => o.completed).length;
        const allDone = obligations.length > 0 && completed === obligations.length;
        const { visible, moreHtml } = this.previewItems('obligations', obligations.map((o, i) => ({ o, i })));

        return this.sectionHtml('obligations', `📋 Today's Obligations
                    ${obligations.length > 0 ? `<span class="completion-badge ${allDone ? 'complete' : ''}">${completed}/${obligations.length}</span>` : ''}`, `
            <div class="obligations-list" id="dash-obligations-list">
                ${obligations.length === 0 ? '<p class="empty-text">No obligations for today yet</p>' : visible.map(({ o, i }) => `
                    <div class="obligation-card ${o.completed ? 'completed' : ''}" data-sort-index="${i}">
                        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                        <div class="obligation-checkbox">
                            <input type="checkbox" id="dash-ob-${i}"
                                ${o.completed ? 'checked' : ''}
                                onchange="App.toggleObligation(${i}); Dashboard.render();">
                            <label for="dash-ob-${i}"></label>
                        </div>
                        <div class="obligation-content">
                            <span class="obligation-title">${Utils.escapeHtml(o.title)}</span>
                            ${o.time ? `<span class="obligation-time">${Utils.escapeHtml(o.time)}</span>` : ''}
                        </div>
                        ${o.completed ? '<div class="completion-badge">✓</div>' : ''}
                    </div>
                `).join('')}
            </div>
            ${moreHtml}
            <form class="add-obligation" onsubmit="Dashboard.addObligation(event)">
                <input type="text" id="new-obligation-title" class="input-text" placeholder="Add an obligation for today...">
                <input type="time" id="new-obligation-time" class="input-time" title="Time (optional)">
                <button type="submit" class="btn btn-secondary btn-sm">+ Add</button>
            </form>
            <div class="today-card-footer">
                <a href="#" onclick="App.showView('obligations'); return false;">View all →</a>
            </div>
        `);
    },

    /** Add an obligation to today's list (at the bottom) from the dashboard. */
    addObligation(event) {
        event.preventDefault();
        const title = document.getElementById('new-obligation-title')?.value.trim();
        if (!title) return;
        const time = document.getElementById('new-obligation-time')?.value || '';
        CommitmentTracker.addObligation(Utils.getLogDateString(), title, time);
        Dashboard.render();
    },

    /** Make the dashboard's obligation list drag-to-reorder; each drop saves immediately. */
    bindObligationSorting() {
        Utils.makeSortable(document.getElementById('dash-obligations-list'), {
            onReorder: (order) => {
                CommitmentTracker.reorderObligations(Utils.getLogDateString(), order);
                Dashboard.render();
            }
        });
    },

    renderTodayPriorities() {
        if (!this.isSectionVisible('priorities')) return '';
        const today = Utils.getLogDateString();
        const commitment = StorageManager.getCommitments(today);
        const priorities = commitment?.priorities || [];
        if (priorities.length === 0) return '';
        return this.sectionHtml('priorities', "🎯 Today's Priorities", `
            <div class="priorities-summary">
                ${priorities.map(p => `
                    <div class="priority-item">
                        <span class="priority-level ${p.priority}">${p.priority}</span>
                        <span class="priority-title">${Utils.escapeHtml(p.title)}</span>
                        ${p.rating ? `<span class="priority-rating">${'⭐'.repeat(p.rating)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `);
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
     * Render tasks section — all incomplete tasks, overdue first, then by
     * priority (high→low), then by soonest due date within each tier.
     */
    renderTasksSection() {
        if (!this.isSectionVisible('tasks')) return '';
        const tasks = TaskManager.getAllIncompleteSorted();
        const today = Utils.getLogDateString();
        const { visible, moreHtml } = this.previewItems('tasks', tasks);

        return this.sectionHtml('tasks', `✓ Tasks <span class="badge">${tasks.length}</span>`, `
            <div class="today-card">
            <div class="today-card-body">
            ${tasks.length > 0 ? `
                <ul class="quick-list">
                    ${visible.map(task => {
                        const overdue = task.dueDate && task.dueDate < today;
                        return `
                            <li class="${overdue ? 'overdue' : ''}">
                                <input type="checkbox"
                                       onchange="TaskManager.toggleTask('${task.id}'); Dashboard.render();">
                                <span class="task-priority-dot priority-${task.priority}"></span>
                                <span>${Utils.escapeHtml(task.title)}</span>
                                ${overdue ? '<span class="overdue-tag">overdue</span>' : ''}
                            </li>
                        `;
                    }).join('')}
                </ul>
                ${moreHtml}
            ` : '<p class="empty-text">No tasks pending</p>'}
            </div>
            <div class="today-card-footer">
                <a href="#" onclick="App.showView('tasks'); return false;">View all →</a>
            </div>
            </div>
        `);
    },

    /**
     * Render today's habits section
     */
    renderHabitsSection(habitStats) {
        if (!this.isSectionVisible('habits')) return '';
        const todayHabits = HabitManager.getTodayHabits();
        const today = Utils.getLogDateString();
        const { visible, moreHtml } = this.previewItems('habits', todayHabits);

        return this.sectionHtml('habits', `🔄 Habits <span class="badge">${habitStats.todayCompleted}/${habitStats.todayTotal}</span>`, `
            <div class="today-card">
            <div class="today-card-body">
            ${todayHabits.length > 0 ? `
                <ul class="quick-list">
                    ${visible.map(habit => {
                        const completed = HabitManager.isCompleted(habit.id, today);
                        let suffix = '';
                        if (HabitManager.isSubdivided(habit)) {
                            const doneCount = HabitManager.getSubSlots(habit, today).filter(Boolean).length;
                            suffix = ` (${doneCount}/${habit.subCount})`;
                        } else if (habit.frequency === 'weekly-count') {
                            const weekKey = CommitmentTracker.getWeekKey(new Date(today + 'T12:00:00'));
                            const count = HabitManager.countCompletionsInWeek(habit, weekKey);
                            suffix = ` (${count}/${habit.weeklyTarget} this wk)`;
                        }
                        return `
                            <li class="${completed ? 'completed' : ''}">
                                <input type="checkbox"
                                       ${completed ? 'checked' : ''}
                                       onchange="HabitManager.toggleNextSlot('${habit.id}'); Dashboard.render();">
                                <span>${Utils.escapeHtml(habit.name)}${suffix}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
                ${moreHtml}
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
        `);
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
        const today = Utils.getLogDateString();
        const completedHabits = HabitManager.getActiveHabits()
            .filter(h => h.completions.includes(today))
            .slice(0, 3);
        
        completedHabits.forEach(habit => {
            activities.push({
                type: 'habit',
                icon: '🔄',
                text: `Completed habit: ${habit.name}`,
                // Habits only store a completion DATE, not a time, so there's
                // no real timestamp to use. Anchoring to midday of that date
                // (rather than "right now") avoids habits always showing
                // "Just now" and always sorting above genuinely more recent
                // task completions regardless of when they actually happened.
                time: new Date(today + 'T12:00:00').toISOString()
            });
        });

        // Sort by time
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));

        if (activities.length === 0) {
            return '<p class="empty-text">No recent activity</p>';
        }

        const { visible, moreHtml } = this.previewItems('activity', activities.slice(0, 10));
        return `
            <ul class="activity-list">
                ${visible.map(activity => `
                    <li class="activity-item">
                        <span class="activity-icon">${activity.icon}</span>
                        <span class="activity-text">${Utils.escapeHtml(activity.text)}</span>
                        <span class="activity-time">${this.getRelativeTime(activity.time)}</span>
                    </li>
                `).join('')}
            </ul>
            ${moreHtml}
        `;
    },

    /**
     * Render tomorrow's commitments
     */
    renderTomorrowCommitments(commitment) {
        if (!this.isSectionVisible('tomorrow')) return '';
        if (!commitment.wakeup?.commitment) return '';

        return this.sectionHtml('tomorrow', "🌙 Tomorrow's Commitments", `
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
        `, 'commitment-preview');
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
        const today = Utils.getLogDateString();
        const data = [];
        let totalMinutes = 0;
        
        // Color palette for different activities
        const colors = [
            '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
            '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
        ];
        let colorIndex = 0;
        
        // 1. Add time-tracked activities (by specific activity name, not category)
        // Use entry.date which respects the 5am boundary
        const todayEntries = TimeTracker.timeEntries.filter(entry => {
            return entry.date === today;
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

    getWeeklyTimeDistribution() {
    const colors = [
        '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
        '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];
    let colorIndex = 0;
    const data = [];
    let totalMinutes = 0;

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    // Time tracked entries
    TimeTracker.timeEntries.forEach(entry => {
        const entryDate = new Date(entry.startTime);
        if (entryDate >= start && entryDate <= end) {
            const existing = data.find(d => d.name === entry.activity);
            if (existing) {
                existing.totalMinutes += entry.duration;
            } else {
                data.push({ name: entry.activity, totalMinutes: entry.duration, color: colors[colorIndex++ % colors.length] });
            }
            totalMinutes += entry.duration;
        }
    });

    // Screentime across the week
    let weeklyScreentime = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const entry = ScreentimeTracker.getEntry(Utils.getDateString(new Date(d)));
        if (entry) weeklyScreentime += entry.totalMinutes;
    }
    if (weeklyScreentime > 0) {
        data.push({ name: 'Social Media & Games', totalMinutes: weeklyScreentime, color: '#ef4444' });
        totalMinutes += weeklyScreentime;
    }

    // Sleep across the week
    const allCommitments = StorageManager.getAllCommitments();
    let weeklySleep = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = Utils.getDateString(new Date(d));
        const prevDate = new Date(d);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = Utils.getDateString(prevDate);
        const todayC = allCommitments[dateStr];
        const prevC = allCommitments[prevDateStr];
        if (todayC?.wakeup?.actual && prevC?.bedtime?.actual) {
            weeklySleep += this.calculateSleepDuration(prevC.bedtime.actual, todayC.wakeup.actual);
        }
    }
    if (weeklySleep > 0) {
        data.push({ name: 'Sleep', totalMinutes: weeklySleep, color: '#6366f1' });
        totalMinutes += weeklySleep;
    }

    if (data.length === 0) return { hasData: false };

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
        const screentimeGoal = StorageManager.getSettings().screentimeGoalMinutes || 90;
        const screentimeStreak = ScreentimeTracker.getStreak(screentimeGoal);
        // Paused habits are deliberately not being tracked right now, so a
        // frozen streak (often 0) sitting on the dashboard is just noise —
        // exclude them here (they still show, clearly labeled, in their own
        // section on the Habits page).
        const activeHabits = HabitManager.getActiveHabits().filter(h => !HabitManager.isPaused(h));

        // Get ALL non-paused habits with their streaks, sorted by current streak
        const habitStreaks = activeHabits
            .map(habit => ({
                ...habit,
                streak: HabitManager.calculateStreak(habit.id)
            }))
            .sort((a, b) => b.streak.current - a.streak.current);
        
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
                
                <!-- All Habits -->
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

    toggleWeeklyGoal(storeKey, index) {
        const reviews = StorageManager.getWeeklyReviews();
        const review = reviews[storeKey];
        if (!review || !review.goals || !review.goals[index]) return;
        const goal = review.goals[index];
        goal.completed = !goal.completed;
        // Keep the review verdict in step with the tick
        if (goal.completed) goal.status = 'done'; else delete goal.status;
        StorageManager.saveWeeklyReview(storeKey, review);
    },

    addWeeklyGoal(event, weekKey) {
        event.preventDefault();
        const input = document.getElementById('new-weekly-goal');
        const title = input?.value.trim();
        if (!title) return;
        CommitmentTracker.addGoalForWeek(weekKey, title);
        Dashboard.render();
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