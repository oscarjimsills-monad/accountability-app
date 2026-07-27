/**
 * Habit Tracking Module
 * Handles habit creation, tracking, and streak calculations
 *
 * Core principle: a habit only exists from its createdAt date onwards,
 * and is only "active" when not within a pause period. Days before creation
 * or within pause periods are skipped entirely — not counted as failures.
 */

const HabitManager = {
    habits: [],

    /**
     * Initialize habit manager
     */
    init() {
        this.loadHabits();
    },

    /**
     * Load habits from storage
     */
    loadHabits() {
        this.habits = StorageManager.getHabits();
        return this.habits;
    },

    /**
     * Save habits to storage
     */
    saveHabits() {
        return StorageManager.saveHabits(this.habits);
    },

    /**
     * Create a new habit
     */
    createHabit(habitData) {
        const habit = {
            id: Utils.generateId(),
            name: habitData.name,
            description: habitData.description || '',
            frequency: habitData.frequency || 'daily', // daily, weekly
            category: habitData.category || 'personal',
            targetDays: habitData.targetDays || [], // For weekly: [0,1,2,3,4,5,6]
            completions: [], // Array of date strings
            pausePeriods: [], // Array of { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' | null }
            createdDate: Utils.getLogDateString(), // local-time date string — use this for comparisons
            createdAt: new Date().toISOString(),
            archived: false
        };

        this.habits.push(habit);
        this.saveHabits();

        Utils.showSuccess('Habit created!');
        return habit;
    },

    /**
     * Get habit by ID
     */
    getHabit(id) {
        return this.habits.find(habit => habit.id === id);
    },

    /**
     * Update habit
     */
    updateHabit(id, updates) {
        const habit = this.getHabit(id);
        if (!habit) {
            Utils.showError('Habit not found');
            return null;
        }

        Object.assign(habit, updates);
        this.saveHabits();

        Utils.showSuccess('Habit updated!');
        return habit;
    },

    /**
     * Delete habit
     */
    deleteHabit(id) {
        const index = this.habits.findIndex(habit => habit.id === id);
        if (index === -1) {
            Utils.showError('Habit not found');
            return false;
        }

        this.habits.splice(index, 1);
        this.saveHabits();

        Utils.showSuccess('Habit deleted!');
        return true;
    },

    /**
     * Archive/unarchive habit
     */
    toggleArchive(id) {
        const habit = this.getHabit(id);
        if (!habit) return null;

        habit.archived = !habit.archived;
        this.saveHabits();

        Utils.showSuccess(habit.archived ? 'Habit archived!' : 'Habit restored!');
        return habit;
    },

    // ─── Pause / Resume ──────────────────────────────────────────────────────

    /**
     * Check if a habit is currently paused
     */
    isPaused(habit) {
        if (!habit.pausePeriods || habit.pausePeriods.length === 0) return false;
        return habit.pausePeriods[habit.pausePeriods.length - 1].to === null;
    },

    /**
     * Pause a habit. The pause period starts TOMORROW so today still counts.
     */
    pauseHabit(id) {
        const habit = this.getHabit(id);
        if (!habit) return null;
        if (this.isPaused(habit)) return habit; // already paused

        if (!habit.pausePeriods) habit.pausePeriods = [];

        const tomorrow = new Date(Utils.getLogDateString() + 'T12:00:00');
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = Utils.getDateString(tomorrow);

        habit.pausePeriods.push({ from: tomorrowStr, to: null });
        this.saveHabits();

        Utils.showSuccess('Habit paused');
        return habit;
    },

    /**
     * Resume a paused habit. The pause period ends YESTERDAY so today counts again.
     */
    resumeHabit(id) {
        const habit = this.getHabit(id);
        if (!habit || !this.isPaused(habit)) return null;

        const yesterday = new Date(Utils.getLogDateString() + 'T12:00:00');
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = Utils.getDateString(yesterday);

        const lastPeriod = habit.pausePeriods[habit.pausePeriods.length - 1];
        lastPeriod.to = yesterdayStr;
        this.saveHabits();

        Utils.showSuccess('Habit resumed');
        return habit;
    },

    /**
     * Check whether a date falls before the habit was created.
     * Pre-creation days are skipped in streaks (neutral — habit didn't exist).
     * Uses createdDate (local-time string) if available, falls back to deriving
     * from createdAt for habits created before this field was added.
     */
    isBeforeCreation(habit, dateStr) {
        // Use createdDate (local-time) if available; fall back to deriving from createdAt (ISO)
        const createdDateStr = habit.createdDate || Utils.getDateString(new Date(habit.createdAt));
        return dateStr < createdDateStr;
    },

    /**
     * Check whether a date falls within a pause period.
     * Pause periods BREAK streaks — the habit existed but was stopped.
     */
    isInPausePeriod(habit, dateStr) {
        for (const period of (habit.pausePeriods || [])) {
            const to = period.to || '9999-12-31';
            if (dateStr >= period.from && dateStr <= to) return true;
        }
        return false;
    },

    /**
     * Check whether a specific date is an "active" day for this habit.
     * Returns false if the date is before creation OR within a pause period.
     * Only active days count toward success rates.
     */
    isDateActive(habit, dateStr) {
        return !this.isBeforeCreation(habit, dateStr) && !this.isInPausePeriod(habit, dateStr);
    },

    // ─── Completions ─────────────────────────────────────────────────────────

    /**
     * Mark habit as complete for a date
     */
    completeHabit(id, date = Utils.getLogDateString()) {
        const habit = this.getHabit(id);
        if (!habit) return null;

        if (!habit.completions.includes(date)) {
            habit.completions.push(date);
            habit.completions.sort();
            this.saveHabits();
            Utils.showSuccess('Habit completed! 🎉');
        }

        return habit;
    },

    /**
     * Mark habit as incomplete for a date
     */
    uncompleteHabit(id, date = Utils.getLogDateString()) {
        const habit = this.getHabit(id);
        if (!habit) return null;

        const index = habit.completions.indexOf(date);
        if (index > -1) {
            habit.completions.splice(index, 1);
            this.saveHabits();
        }

        return habit;
    },

    /**
     * Toggle habit completion for a date
     */
    toggleHabit(id, date = Utils.getLogDateString()) {
        const habit = this.getHabit(id);
        if (!habit) return null;

        if (habit.completions.includes(date)) {
            return this.uncompleteHabit(id, date);
        } else {
            return this.completeHabit(id, date);
        }
    },

    /**
     * Check if habit is completed for a date
     */
    isCompleted(id, date = Utils.getLogDateString()) {
        const habit = this.getHabit(id);
        if (!habit) return false;
        return habit.completions.includes(date);
    },

    // ─── Statistics ──────────────────────────────────────────────────────────

    /**
     * Calculate current and longest streak.
     *
     * Inactive days (pre-creation, pause periods) are skipped transparently —
     * they do not break a streak and are not counted as misses.
     */
    calculateStreak(id) {
        const habit = this.getHabit(id);
        if (!habit) return { current: 0, longest: 0 };

        const today = Utils.getLogDateString();
        const createdDateStr = habit.createdDate || Utils.getDateString(new Date(habit.createdAt));
        const completionSet = new Set(habit.completions);

        // ── Current streak ──────────────────────────────────────────────────
        // Walk backwards from today.
        // - Pre-creation days: skip (neutral)
        // - Pause period days: BREAK streak
        // - Active day not completed: BREAK streak
        let currentStreak = 0;
        let d = new Date(today + 'T12:00:00');

        // If today is active and not yet completed, start counting from yesterday
        if (this.isDateActive(habit, today) && !completionSet.has(today)) {
            d.setDate(d.getDate() - 1);
        }

        while (Utils.getDateString(d) >= createdDateStr) {
            const dateStr = Utils.getDateString(d);

            if (this.isBeforeCreation(habit, dateStr)) {
                // Shouldn't happen given the while condition, but be safe
                break;
            }

            if (this.isInPausePeriod(habit, dateStr)) {
                // Pausing breaks the streak — stop here
                break;
            }

            if (completionSet.has(dateStr)) {
                currentStreak++;
                d.setDate(d.getDate() - 1);
            } else {
                // Active day that was missed — streak is over
                break;
            }
        }

        // ── Longest streak ──────────────────────────────────────────────────
        // Walk forward from first completion to last.
        // - Pre-creation: skip (neutral)
        // - Pause period: reset streak (break)
        // - Active missed day: reset streak
        let longestStreak = currentStreak;

        if (habit.completions.length > 0) {
            const sortedCompletions = [...habit.completions].sort();
            const firstDate = sortedCompletions[0];
            const lastDate = sortedCompletions[sortedCompletions.length - 1];

            let tempStreak = 0;
            let fd = new Date(firstDate + 'T12:00:00');
            const ldDate = new Date(lastDate + 'T12:00:00');

            while (fd <= ldDate) {
                const dateStr = Utils.getDateString(fd);

                if (this.isBeforeCreation(habit, dateStr)) {
                    // Skip pre-creation (shouldn't occur here, but be safe)
                    fd.setDate(fd.getDate() + 1);
                    continue;
                }

                if (this.isInPausePeriod(habit, dateStr)) {
                    // Pause breaks the streak
                    tempStreak = 0;
                    fd.setDate(fd.getDate() + 1);
                    continue;
                }

                if (completionSet.has(dateStr)) {
                    tempStreak++;
                    longestStreak = Math.max(longestStreak, tempStreak);
                } else {
                    tempStreak = 0;
                }

                fd.setDate(fd.getDate() + 1);
            }
        }

        return { current: currentStreak, longest: longestStreak };
    },

    /**
     * Calculate success rate over the past N days.
     * Only active days (post-creation, not paused) count toward the total.
     */
    calculateSuccessRate(id, days = 30) {
        const habit = this.getHabit(id);
        if (!habit) return 0;

        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - days);

        let totalDays = 0;
        let completedDays = 0;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = Utils.getDateString(d);
            if (this.isDateActive(habit, dateStr)) {
                totalDays++;
                if (habit.completions.includes(dateStr)) completedDays++;
            }
        }

        return totalDays > 0 ? Utils.calculatePercentage(completedDays, totalDays) : 0;
    },

    // ─── Filters ─────────────────────────────────────────────────────────────

    /**
     * Get non-archived habits (includes paused ones — they show in a paused section)
     */
    getActiveHabits() {
        return this.habits.filter(habit => !habit.archived);
    },

    /**
     * Get archived habits
     */
    getArchivedHabits() {
        return this.habits.filter(habit => habit.archived);
    },

    /**
     * Get habits that should appear in today's daily view.
     * Excludes archived and currently paused habits.
     */
    getTodayHabits() {
        const today = new Date().getDay(); // 0 = Sunday
        const todayStr = Utils.getLogDateString();

        return this.getActiveHabits().filter(habit => {
            // Skip paused habits
            if (this.isPaused(habit)) return false;
            // Skip if today is somehow inactive (shouldn't happen for non-paused, but be safe)
            if (!this.isDateActive(habit, todayStr)) return false;

            if (habit.frequency === 'daily') return true;
            if (habit.frequency === 'weekly' && habit.targetDays.includes(today)) return true;
            return false;
        });
    },

    // ─── Stats summary ───────────────────────────────────────────────────────

    /**
     * Get habit statistics
     */
    getStats() {
        const active = this.getActiveHabits();
        const today = Utils.getLogDateString();
        const todayHabits = this.getTodayHabits();
        const completedToday = todayHabits.filter(h => h.completions.includes(today)).length;

        let totalStreaks = 0;
        let longestStreak = 0;

        active.forEach(habit => {
            const streak = this.calculateStreak(habit.id);
            totalStreaks += streak.current;
            longestStreak = Math.max(longestStreak, streak.longest);
        });

        return {
            total: active.length,
            todayTotal: todayHabits.length,
            todayCompleted: completedToday,
            todayRemaining: todayHabits.length - completedToday,
            completionRate: Utils.calculatePercentage(completedToday, todayHabits.length),
            averageStreak: active.length > 0 ? Math.round(totalStreaks / active.length) : 0,
            longestStreak
        };
    },

    /**
     * Get completion calendar data
     */
    getCalendarData(id, year, month) {
        const habit = this.getHabit(id);
        if (!habit) return [];

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const calendar = [];

        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            const dateStr = Utils.getDateString(d);
            calendar.push({
                date: dateStr,
                completed: habit.completions.includes(dateStr),
                active: this.isDateActive(habit, dateStr)
            });
        }

        return calendar;
    },

    // ─── Rendering ───────────────────────────────────────────────────────────

    /**
     * Render habit list — active habits first, then a collapsed paused section
     */
    renderHabitList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const allHabits = this.getActiveHabits();
        const activeHabits = allHabits.filter(h => !this.isPaused(h));
        const pausedHabits = allHabits.filter(h => this.isPaused(h));

        if (allHabits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No habits yet</p>
                    <button class="btn btn-primary" onclick="HabitManager.showCreateHabitModal()">
                        Create Habit
                    </button>
                </div>
            `;
            return;
        }

        let html = activeHabits.map(habit => this.renderHabitCard(habit)).join('');

        if (pausedHabits.length > 0) {
            html += `
                <div class="paused-habits-section">
                    <h3 class="paused-habits-heading">⏸ Paused (${pausedHabits.length})</h3>
                    ${pausedHabits.map(habit => this.renderHabitCard(habit)).join('')}
                </div>
            `;
        }

        container.innerHTML = html;
    },

    /**
     * Render a single habit card
     */
    renderHabitCard(habit) {
        const today = Utils.getLogDateString();
        const paused = this.isPaused(habit);
        const completed = !paused && habit.completions.includes(today);
        const streak = this.calculateStreak(habit.id);
        const successRate = this.calculateSuccessRate(habit.id, 30);

        const pausedBadge = paused
            ? `<span class="habit-paused-badge">Paused</span>`
            : '';

        const checkBtn = paused ? '' : `
            <button class="habit-check ${completed ? 'checked' : ''}"
                    onclick="HabitManager.toggleHabit('${habit.id}'); HabitManager.refreshCurrentView();"
                    title="${completed ? 'Mark incomplete' : 'Mark complete'}">
                ${completed ? '✓' : ''}
            </button>
        `;

        const pauseResumeBtn = paused
            ? `<button class="btn btn-sm btn-secondary habit-pause-btn" onclick="HabitManager.resumeHabit('${habit.id}'); HabitManager.refreshCurrentView();">▶ Resume</button>`
            : `<button class="btn btn-sm btn-secondary habit-pause-btn" onclick="HabitManager.pauseHabit('${habit.id}'); HabitManager.refreshCurrentView();">⏸ Pause</button>`;

        return `
            <div class="habit-card ${completed ? 'completed' : ''} ${paused ? 'paused' : ''}" data-habit-id="${habit.id}">
                <div class="habit-header">
                    <div class="habit-info">
                        <h3 class="habit-name">${Utils.escapeHtml(habit.name)} ${pausedBadge}</h3>
                        <span class="habit-category">${habit.category}</span>
                    </div>
                    ${checkBtn}
                </div>

                ${habit.description ? `<p class="habit-description">${Utils.escapeHtml(habit.description)}</p>` : ''}

                <div class="habit-stats">
                    <div class="habit-stat">
                        <span class="stat-icon">🔥</span>
                        <span class="stat-value">${streak.current}</span>
                        <span class="stat-label">Streak</span>
                    </div>
                    <div class="habit-stat">
                        <span class="stat-icon">📈</span>
                        <span class="stat-value">${successRate}%</span>
                        <span class="stat-label">30-day</span>
                    </div>
                    <div class="habit-stat">
                        <span class="stat-icon">🏆</span>
                        <span class="stat-value">${streak.longest}</span>
                        <span class="stat-label">Best</span>
                    </div>
                </div>

                <div class="habit-actions">
                    <button class="btn-icon" onclick="HabitManager.showHabitDetails('${habit.id}')" title="Details">📊</button>
                    <button class="btn-icon" onclick="HabitManager.showEditHabitModal('${habit.id}')" title="Edit">✏️</button>
                    ${pauseResumeBtn}
                    <button class="btn-icon" onclick="HabitManager.confirmDeleteHabit('${habit.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        `;
    },

    // ─── Modals ──────────────────────────────────────────────────────────────

    /**
     * Show create habit modal
     */
    showCreateHabitModal() {
        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="HabitManager.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Create Habit</h2>
                        <button class="btn-close" onclick="HabitManager.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="habit-form" onsubmit="HabitManager.handleCreateHabit(event)">
                            <div class="form-group">
                                <label for="habit-name">Habit Name *</label>
                                <input type="text" id="habit-name" class="input-text" required>
                            </div>

                            <div class="form-group">
                                <label for="habit-description">Description</label>
                                <textarea id="habit-description" class="input-textarea" rows="2"></textarea>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="habit-frequency">Frequency</label>
                                    <select id="habit-frequency" class="input-select">
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Specific Days</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="habit-category">Category</label>
                                    <select id="habit-category" class="input-select">
                                        <option value="personal">Personal</option>
                                        <option value="health">Health</option>
                                        <option value="fitness">Fitness</option>
                                        <option value="learning">Learning</option>
                                        <option value="productivity">Productivity</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div id="weekly-days" class="form-group" style="display: none;">
                                <label>Target Days</label>
                                <div class="day-selector">
                                    <label><input type="checkbox" value="0"> Sun</label>
                                    <label><input type="checkbox" value="1"> Mon</label>
                                    <label><input type="checkbox" value="2"> Tue</label>
                                    <label><input type="checkbox" value="3"> Wed</label>
                                    <label><input type="checkbox" value="4"> Thu</label>
                                    <label><input type="checkbox" value="5"> Fri</label>
                                    <label><input type="checkbox" value="6"> Sat</label>
                                </div>
                            </div>

                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="HabitManager.closeModal()">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    Create Habit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('habit-frequency').addEventListener('change', (e) => {
            document.getElementById('weekly-days').style.display =
                e.target.value === 'weekly' ? 'block' : 'none';
        });

        modal.style.display = 'flex';
    },

    /**
     * Show edit habit modal
     */
    showEditHabitModal(habitId) {
        const habit = this.getHabit(habitId);
        if (!habit) return;

        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="HabitManager.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Edit Habit</h2>
                        <button class="btn-close" onclick="HabitManager.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="habit-form" onsubmit="HabitManager.handleEditHabit(event, '${habitId}')">
                            <div class="form-group">
                                <label for="habit-name">Habit Name *</label>
                                <input type="text" id="habit-name" class="input-text" value="${Utils.escapeHtml(habit.name)}" required>
                            </div>

                            <div class="form-group">
                                <label for="habit-description">Description</label>
                                <textarea id="habit-description" class="input-textarea" rows="2">${Utils.escapeHtml(habit.description)}</textarea>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="habit-frequency">Frequency</label>
                                    <select id="habit-frequency" class="input-select">
                                        <option value="daily" ${habit.frequency === 'daily' ? 'selected' : ''}>Daily</option>
                                        <option value="weekly" ${habit.frequency === 'weekly' ? 'selected' : ''}>Specific Days</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="habit-category">Category</label>
                                    <select id="habit-category" class="input-select">
                                        <option value="personal" ${habit.category === 'personal' ? 'selected' : ''}>Personal</option>
                                        <option value="health" ${habit.category === 'health' ? 'selected' : ''}>Health</option>
                                        <option value="fitness" ${habit.category === 'fitness' ? 'selected' : ''}>Fitness</option>
                                        <option value="learning" ${habit.category === 'learning' ? 'selected' : ''}>Learning</option>
                                        <option value="productivity" ${habit.category === 'productivity' ? 'selected' : ''}>Productivity</option>
                                        <option value="other" ${habit.category === 'other' ? 'selected' : ''}>Other</option>
                                    </select>
                                </div>
                            </div>

                            <div id="weekly-days" class="form-group" style="display: ${habit.frequency === 'weekly' ? 'block' : 'none'};">
                                <label>Target Days</label>
                                <div class="day-selector">
                                    <label><input type="checkbox" value="0" ${habit.targetDays?.includes(0) ? 'checked' : ''}> Sun</label>
                                    <label><input type="checkbox" value="1" ${habit.targetDays?.includes(1) ? 'checked' : ''}> Mon</label>
                                    <label><input type="checkbox" value="2" ${habit.targetDays?.includes(2) ? 'checked' : ''}> Tue</label>
                                    <label><input type="checkbox" value="3" ${habit.targetDays?.includes(3) ? 'checked' : ''}> Wed</label>
                                    <label><input type="checkbox" value="4" ${habit.targetDays?.includes(4) ? 'checked' : ''}> Thu</label>
                                    <label><input type="checkbox" value="5" ${habit.targetDays?.includes(5) ? 'checked' : ''}> Fri</label>
                                    <label><input type="checkbox" value="6" ${habit.targetDays?.includes(6) ? 'checked' : ''}> Sat</label>
                                </div>
                            </div>

                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="HabitManager.closeModal()">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('habit-frequency').addEventListener('change', (e) => {
            document.getElementById('weekly-days').style.display =
                e.target.value === 'weekly' ? 'block' : 'none';
        });

        modal.style.display = 'flex';
    },

    /**
     * Handle create habit form submission
     */
    handleCreateHabit(event) {
        event.preventDefault();

        const frequency = document.getElementById('habit-frequency').value;
        let targetDays = [];

        if (frequency === 'weekly') {
            const checkboxes = document.querySelectorAll('#weekly-days input[type="checkbox"]:checked');
            targetDays = Array.from(checkboxes).map(cb => parseInt(cb.value));

            if (targetDays.length === 0) {
                Utils.showError('Please select at least one day');
                return;
            }
        }

        const habitData = {
            name: document.getElementById('habit-name').value.trim(),
            description: document.getElementById('habit-description').value.trim(),
            frequency: frequency,
            category: document.getElementById('habit-category').value,
            targetDays: targetDays
        };

        this.createHabit(habitData);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Handle edit habit form submission
     */
    handleEditHabit(event, habitId) {
        event.preventDefault();

        const frequency = document.getElementById('habit-frequency').value;
        let targetDays = [];

        if (frequency === 'weekly') {
            const checkboxes = document.querySelectorAll('#weekly-days input[type="checkbox"]:checked');
            targetDays = Array.from(checkboxes).map(cb => parseInt(cb.value));

            if (targetDays.length === 0) {
                Utils.showError('Please select at least one day');
                return;
            }
        }

        const updates = {
            name: document.getElementById('habit-name').value.trim(),
            description: document.getElementById('habit-description').value.trim(),
            frequency: frequency,
            category: document.getElementById('habit-category').value,
            targetDays: targetDays
        };

        this.updateHabit(habitId, updates);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Show habit details
     */
    showHabitDetails(habitId) {
        const habit = this.getHabit(habitId);
        if (!habit) return;

        const streak = this.calculateStreak(habitId);
        const successRate = this.calculateSuccessRate(habitId, 30);
        const paused = this.isPaused(habit);

        alert(
            `${habit.name}${paused ? ' (Paused)' : ''}\n\n` +
            `Current Streak: ${streak.current} days\n` +
            `Longest Streak: ${streak.longest} days\n` +
            `30-day Success: ${successRate}%\n` +
            `Total Completions: ${habit.completions.length}\n` +
            `Pause periods: ${(habit.pausePeriods || []).length}`
        );
    },

    /**
     * Confirm delete habit
     */
    confirmDeleteHabit(habitId) {
        const habit = this.getHabit(habitId);
        if (!habit) return;

        if (confirm(`Delete habit "${habit.name}"? This cannot be undone.`)) {
            this.deleteHabit(habitId);
            this.refreshCurrentView();
        }
    },

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('modal-container');
        modal.style.display = 'none';
        modal.innerHTML = '';
    },

    /**
     * Refresh current view
     */
    refreshCurrentView() {
        if (window.App && window.App.refreshCurrentView) {
            window.App.refreshCurrentView();
        }
    }
};

// Make HabitManager available globally
window.HabitManager = HabitManager;

// Made with Bob
