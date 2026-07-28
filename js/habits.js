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
            frequency: habitData.frequency || 'daily', // daily, weekly, weekly-count
            category: habitData.category || 'personal',
            targetDays: habitData.targetDays || [], // For weekly: [0,1,2,3,4,5,6]
            subCount: habitData.subCount || 1, // For daily: sub-divide into N independent checks/day
            weeklyTarget: habitData.weeklyTarget || null, // For weekly-count: N completions needed per week (any days)
            // Array of date strings. Sub-divided daily habits use slot-tagged
            // entries 'YYYY-MM-DD#N' (N = 0..subCount-1) instead of a plain date.
            completions: [],
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

    // ─── Sub-division & weekly-count helpers ────────────────────────────────

    /**
     * A habit is "subdivided" when it's daily and configured for more than
     * one independent check per day (e.g. "brush teeth" x3/day).
     */
    isSubdivided(habit) {
        return habit.frequency === 'daily' && (habit.subCount || 1) > 1;
    },

    /**
     * For a subdivided habit, which of its N daily slots are checked for date.
     */
    getSubSlots(habit, date) {
        const subCount = habit.subCount || 1;
        const slots = [];
        for (let i = 0; i < subCount; i++) {
            slots.push(habit.completions.includes(`${date}#${i}`));
        }
        return slots;
    },

    /**
     * Toggle one specific slot of a subdivided habit for a date.
     */
    toggleHabitSlot(id, date, slotIndex) {
        const habit = this.getHabit(id);
        if (!habit) return null;

        const key = `${date}#${slotIndex}`;
        const idx = habit.completions.indexOf(key);
        if (idx > -1) {
            habit.completions.splice(idx, 1);
        } else {
            habit.completions.push(key);
            habit.completions.sort();
        }
        this.saveHabits();

        if (this.getSubSlots(habit, date).every(Boolean)) {
            Utils.showSuccess('Habit completed! 🎉');
        }
        return habit;
    },

    /**
     * Single-click completion for compact UIs (dashboard, evening review,
     * history). For a subdivided habit this checks the next unchecked slot,
     * or unchecks the last slot if all are already done (so a single click
     * still has an obvious undo). For everything else it's a plain toggle.
     */
    toggleNextSlot(id, date = Utils.getLogDateString()) {
        const habit = this.getHabit(id);
        if (!habit) return null;
        if (!this.isSubdivided(habit)) return this.toggleHabit(id, date);

        const slots = this.getSubSlots(habit, date);
        const nextUnchecked = slots.indexOf(false);
        const slotToToggle = nextUnchecked !== -1 ? nextUnchecked : slots.length - 1;
        return this.toggleHabitSlot(id, date, slotToToggle);
    },

    /**
     * How many completions fall within the week starting at weekKey (a
     * Monday date string) — used for 'weekly-count' habits. Counts every
     * logged instance, not just distinct days: two runs on the same day
     * both count toward the weekly target.
     */
    countCompletionsInWeek(habit, weekKey) {
        const start = new Date(weekKey + 'T12:00:00');
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const startStr = Utils.getDateString(start);
        const endStr = Utils.getDateString(end);
        return habit.completions.filter(c => c >= startStr && c <= endStr).length;
    },

    /**
     * How many completions are logged for a specific date (weekly-count
     * habits can have more than one per day).
     */
    countCompletionsOnDate(habit, date) {
        return habit.completions.filter(c => c === date).length;
    },

    /**
     * Add one completion instance for a weekly-count habit. Unlike
     * toggleHabit, this always adds rather than toggling — so logging twice
     * in one day genuinely counts as two toward the weekly target.
     */
    addWeeklyCountCompletion(id, date = Utils.getLogDateString()) {
        const habit = this.getHabit(id);
        if (!habit) return null;
        habit.completions.push(date);
        habit.completions.sort();
        this.saveHabits();
        return habit;
    },

    /**
     * Remove one completion instance (the most recent) for a weekly-count
     * habit on the given date.
     */
    removeWeeklyCountCompletion(id, date = Utils.getLogDateString()) {
        const habit = this.getHabit(id);
        if (!habit) return null;
        const idx = habit.completions.lastIndexOf(date);
        if (idx > -1) habit.completions.splice(idx, 1);
        this.saveHabits();
        return habit;
    },

    /**
     * Whether at least one day within the week is active (not paused, not
     * before creation). A fully-inactive week is skipped (neutral) in streaks.
     */
    isWeekActive(habit, weekKey) {
        const start = new Date(weekKey + 'T12:00:00');
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            if (this.isDateActive(habit, Utils.getDateString(d))) return true;
        }
        return false;
    },

    isWeekTargetMet(habit, weekKey) {
        const target = habit.weeklyTarget || 1;
        return this.countCompletionsInWeek(habit, weekKey) >= target;
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
     * Check if habit is completed for a date. For a subdivided daily habit
     * this means ALL of its sub-slots are checked, not just any one of them.
     */
    isCompleted(id, date = Utils.getLogDateString()) {
        const habit = this.getHabit(id);
        if (!habit) return false;
        if (this.isSubdivided(habit)) {
            return this.getSubSlots(habit, date).every(Boolean);
        }
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

        if (habit.frequency === 'weekly-count') {
            return this.calculateWeeklyCountStreak(habit);
        }

        const today = Utils.getLogDateString();
        const createdDateStr = habit.createdDate || Utils.getDateString(new Date(habit.createdAt));

        // ── Current streak ──────────────────────────────────────────────────
        // Walk backwards from today.
        // - Pre-creation days: skip (neutral)
        // - Pause period days: BREAK streak
        // - Active day not completed: BREAK streak
        // isCompleted() handles sub-divided habits (all slots checked) too.
        let currentStreak = 0;
        let d = new Date(today + 'T12:00:00');

        // If today is active and not yet completed, start counting from yesterday
        if (this.isDateActive(habit, today) && !this.isCompleted(id, today)) {
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

            if (this.isCompleted(id, dateStr)) {
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
            // Strip slot suffixes (sub-divided habits) to get plain dates for range bounds
            const plainDates = habit.completions.map(c => c.split('#')[0]);
            const sortedCompletions = [...new Set(plainDates)].sort();
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

                if (this.isCompleted(id, dateStr)) {
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
     * Streak calculation for 'weekly-count' habits: consecutive WEEKS (not
     * days) where the target completion count was met. Weeks entirely before
     * creation or entirely paused are skipped (neutral); a week with the
     * habit active but unmet breaks the streak. The current (in-progress)
     * week is never counted as a miss — if not yet met, the walk starts from
     * last week instead, same "don't penalize an unfinished period" principle
     * used for days elsewhere.
     */
    calculateWeeklyCountStreak(habit) {
        const todayWeekKey = CommitmentTracker.getWeekKey(new Date(Utils.getLogDateString() + 'T12:00:00'));
        const createdDateStr = habit.createdDate || Utils.getDateString(new Date(habit.createdAt));
        const createdWeekKey = CommitmentTracker.getWeekKey(new Date(createdDateStr + 'T12:00:00'));

        // ── Current streak: walk backwards week by week ─────────────────────
        let currentStreak = 0;
        let weekKey = todayWeekKey;

        if (!this.isWeekTargetMet(habit, todayWeekKey)) {
            const d = new Date(weekKey + 'T12:00:00');
            d.setDate(d.getDate() - 7);
            weekKey = Utils.getDateString(d);
        }

        while (weekKey >= createdWeekKey) {
            if (!this.isWeekActive(habit, weekKey)) {
                const d = new Date(weekKey + 'T12:00:00');
                d.setDate(d.getDate() - 7);
                weekKey = Utils.getDateString(d);
                continue;
            }

            if (this.isWeekTargetMet(habit, weekKey)) {
                currentStreak++;
                const d = new Date(weekKey + 'T12:00:00');
                d.setDate(d.getDate() - 7);
                weekKey = Utils.getDateString(d);
            } else {
                break;
            }
        }

        // ── Longest streak: walk forward through all weeks with any data ────
        let longestStreak = currentStreak;

        if (habit.completions.length > 0) {
            const sortedDates = [...habit.completions].sort();
            const firstWeekKey = CommitmentTracker.getWeekKey(new Date(sortedDates[0] + 'T12:00:00'));
            const lastWeekKey = CommitmentTracker.getWeekKey(new Date(sortedDates[sortedDates.length - 1] + 'T12:00:00'));

            let tempStreak = 0;
            let wk = firstWeekKey;

            while (wk <= lastWeekKey) {
                if (!this.isWeekActive(habit, wk)) {
                    const d = new Date(wk + 'T12:00:00');
                    d.setDate(d.getDate() + 7);
                    wk = Utils.getDateString(d);
                    continue;
                }

                if (this.isWeekTargetMet(habit, wk)) {
                    tempStreak++;
                    longestStreak = Math.max(longestStreak, tempStreak);
                } else {
                    tempStreak = 0;
                }

                const d = new Date(wk + 'T12:00:00');
                d.setDate(d.getDate() + 7);
                wk = Utils.getDateString(d);
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

        if (habit.frequency === 'weekly-count') {
            return this.calculateWeeklyCountSuccessRate(habit, days);
        }

        const endDate = new Date(Utils.getLogDateString() + 'T12:00:00');
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - days);

        let totalDays = 0;
        let completedDays = 0;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = Utils.getDateString(d);
            if (this.isDateActive(habit, dateStr)) {
                totalDays++;
                if (this.isCompleted(id, dateStr)) completedDays++;
            }
        }

        return totalDays > 0 ? Utils.calculatePercentage(completedDays, totalDays) : 0;
    },

    /**
     * Success rate for weekly-count habits: percentage of the last ~days/7
     * active weeks that met the weekly target.
     */
    calculateWeeklyCountSuccessRate(habit, days) {
        const numWeeks = Math.max(1, Math.round(days / 7));
        const todayWeekKey = CommitmentTracker.getWeekKey(new Date(Utils.getLogDateString() + 'T12:00:00'));

        let totalWeeks = 0;
        let metWeeks = 0;
        let wk = todayWeekKey;

        for (let i = 0; i < numWeeks; i++) {
            if (this.isWeekActive(habit, wk)) {
                totalWeeks++;
                if (this.isWeekTargetMet(habit, wk)) metWeeks++;
            }
            const d = new Date(wk + 'T12:00:00');
            d.setDate(d.getDate() - 7);
            wk = Utils.getDateString(d);
        }

        return totalWeeks > 0 ? Utils.calculatePercentage(metWeeks, totalWeeks) : 0;
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
        const todayStr = Utils.getLogDateString();
        // Anchor to the log-date (5am boundary) rather than the raw clock —
        // otherwise a Monday-only habit could show as due at 1am Monday even
        // though the app still considers it "Sunday night" for logging purposes.
        const today = new Date(todayStr + 'T12:00:00').getDay(); // 0 = Sunday

        return this.getActiveHabits().filter(habit => {
            // Skip paused habits
            if (this.isPaused(habit)) return false;
            // Skip if today is somehow inactive (shouldn't happen for non-paused, but be safe)
            if (!this.isDateActive(habit, todayStr)) return false;

            if (habit.frequency === 'daily') return true;
            if (habit.frequency === 'weekly' && habit.targetDays.includes(today)) return true;
            if (habit.frequency === 'weekly-count') return true; // any day counts
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
        const completedToday = todayHabits.filter(h => this.isCompleted(h.id, today)).length;

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
                completed: this.isCompleted(id, dateStr),
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
        const subdivided = this.isSubdivided(habit);
        const isWeeklyCount = habit.frequency === 'weekly-count';
        const completed = !paused && this.isCompleted(habit.id, today);
        const streak = this.calculateStreak(habit.id);
        const successRate = this.calculateSuccessRate(habit.id, 30);

        const pausedBadge = paused
            ? `<span class="habit-paused-badge">Paused</span>`
            : '';

        let checkBtn = '';
        if (!paused && subdivided) {
            const slots = this.getSubSlots(habit, today);
            checkBtn = `
                <div class="habit-subslots">
                    ${slots.map((done, i) => `
                        <button class="habit-subslot ${done ? 'checked' : ''}"
                                onclick="HabitManager.toggleHabitSlot('${habit.id}', '${today}', ${i}); HabitManager.refreshCurrentView();"
                                title="${done ? 'Mark incomplete' : 'Mark complete'}">
                            ${done ? '✓' : i + 1}
                        </button>
                    `).join('')}
                </div>
            `;
        } else if (!paused && isWeeklyCount) {
            // Full +/- control here (unlike the compact dashboard/evening-review
            // checkbox) so logging more than once in a day is actually reachable.
            const countToday = this.countCompletionsOnDate(habit, today);
            checkBtn = `
                <div class="habit-count-stepper">
                    <button class="habit-stepper-btn" ${countToday === 0 ? 'disabled' : ''}
                            onclick="HabitManager.removeWeeklyCountCompletion('${habit.id}', '${today}'); HabitManager.refreshCurrentView();"
                            title="Remove one completion">−</button>
                    <span class="habit-stepper-value">${countToday}</span>
                    <button class="habit-stepper-btn"
                            onclick="HabitManager.addWeeklyCountCompletion('${habit.id}', '${today}'); HabitManager.refreshCurrentView();"
                            title="Add a completion for today">+</button>
                </div>
            `;
        } else if (!paused) {
            checkBtn = `
                <button class="habit-check ${completed ? 'checked' : ''}"
                        onclick="HabitManager.toggleHabit('${habit.id}'); HabitManager.refreshCurrentView();"
                        title="${completed ? 'Mark incomplete' : 'Mark complete'}">
                    ${completed ? '✓' : ''}
                </button>
            `;
        }

        let weeklyProgress = '';
        if (isWeeklyCount) {
            const weekKey = CommitmentTracker.getWeekKey(new Date(today + 'T12:00:00'));
            const count = this.countCompletionsInWeek(habit, weekKey);
            const target = habit.weeklyTarget || 1;
            const met = count >= target;
            weeklyProgress = `<div class="habit-weekly-progress ${met ? 'met' : ''}">${count}/${target} this week${met ? ' ✓' : ''}</div>`;
        }

        const streakLabel = isWeeklyCount ? 'Wk Streak' : 'Streak';
        const bestLabel = isWeeklyCount ? 'Best (wks)' : 'Best';

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
                ${weeklyProgress}

                <div class="habit-stats">
                    <div class="habit-stat">
                        <span class="stat-icon">🔥</span>
                        <span class="stat-value">${streak.current}</span>
                        <span class="stat-label">${streakLabel}</span>
                    </div>
                    <div class="habit-stat">
                        <span class="stat-icon">📈</span>
                        <span class="stat-value">${successRate}%</span>
                        <span class="stat-label">30-day</span>
                    </div>
                    <div class="habit-stat">
                        <span class="stat-icon">🏆</span>
                        <span class="stat-value">${streak.longest}</span>
                        <span class="stat-label">${bestLabel}</span>
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
                                        <option value="weekly-count">X Times a Week</option>
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

                            <div id="daily-subcount" class="form-group">
                                <label for="habit-subcount">Times per day (optional)</label>
                                <input type="number" id="habit-subcount" class="input-number" min="1" max="10" value="1">
                                <p class="help-text">e.g. 3 for "brush teeth 3x a day" — the day only counts once all are checked</p>
                            </div>

                            <div id="weekly-target" class="form-group" style="display: none;">
                                <label for="habit-weekly-target">Times per week</label>
                                <input type="number" id="habit-weekly-target" class="input-number" min="1" max="7" value="2">
                                <p class="help-text">e.g. 2 for "run twice a week" — any days count, no fixed schedule</p>
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
            this._syncFrequencyFields(e.target.value);
        });

        modal.style.display = 'flex';
    },

    /**
     * Show/hide the frequency-specific fields (specific days / sub-count /
     * weekly target) based on the selected frequency. Shared by create and edit.
     */
    _syncFrequencyFields(frequency) {
        const weeklyDays = document.getElementById('weekly-days');
        const dailySubcount = document.getElementById('daily-subcount');
        const weeklyTarget = document.getElementById('weekly-target');
        if (weeklyDays) weeklyDays.style.display = frequency === 'weekly' ? 'block' : 'none';
        if (dailySubcount) dailySubcount.style.display = frequency === 'daily' ? 'block' : 'none';
        if (weeklyTarget) weeklyTarget.style.display = frequency === 'weekly-count' ? 'block' : 'none';
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
                                        <option value="weekly-count" ${habit.frequency === 'weekly-count' ? 'selected' : ''}>X Times a Week</option>
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

                            <div id="daily-subcount" class="form-group" style="display: ${habit.frequency === 'daily' ? 'block' : 'none'};">
                                <label for="habit-subcount">Times per day (optional)</label>
                                <input type="number" id="habit-subcount" class="input-number" min="1" max="10" value="${habit.subCount || 1}">
                                <p class="help-text">e.g. 3 for "brush teeth 3x a day" — the day only counts once all are checked</p>
                            </div>

                            <div id="weekly-target" class="form-group" style="display: ${habit.frequency === 'weekly-count' ? 'block' : 'none'};">
                                <label for="habit-weekly-target">Times per week</label>
                                <input type="number" id="habit-weekly-target" class="input-number" min="1" max="7" value="${habit.weeklyTarget || 2}">
                                <p class="help-text">e.g. 2 for "run twice a week" — any days count, no fixed schedule</p>
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
            this._syncFrequencyFields(e.target.value);
        });

        modal.style.display = 'flex';
    },

    /**
     * Handle create habit form submission
     */
    handleCreateHabit(event) {
        event.preventDefault();

        const frequency = document.getElementById('habit-frequency').value;
        const targetDays = this._readTargetDays(frequency);
        if (targetDays === null) return; // validation failed, error already shown

        const habitData = {
            name: document.getElementById('habit-name').value.trim(),
            description: document.getElementById('habit-description').value.trim(),
            frequency: frequency,
            category: document.getElementById('habit-category').value,
            targetDays: targetDays,
            ...this._readFrequencyExtras(frequency)
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
        const targetDays = this._readTargetDays(frequency);
        if (targetDays === null) return;

        const updates = {
            name: document.getElementById('habit-name').value.trim(),
            description: document.getElementById('habit-description').value.trim(),
            frequency: frequency,
            category: document.getElementById('habit-category').value,
            targetDays: targetDays,
            ...this._readFrequencyExtras(frequency)
        };

        this.updateHabit(habitId, updates);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Read + validate the specific-days checkboxes. Returns null (and shows
     * an error) if frequency is 'weekly' but nothing was selected.
     */
    _readTargetDays(frequency) {
        if (frequency !== 'weekly') return [];
        const checkboxes = document.querySelectorAll('#weekly-days input[type="checkbox"]:checked');
        const targetDays = Array.from(checkboxes).map(cb => parseInt(cb.value));
        if (targetDays.length === 0) {
            Utils.showError('Please select at least one day');
            return null;
        }
        return targetDays;
    },

    /**
     * Read subCount (daily sub-division) or weeklyTarget (weekly-count),
     * whichever applies to the given frequency.
     */
    _readFrequencyExtras(frequency) {
        if (frequency === 'daily') {
            let subCount = parseInt(document.getElementById('habit-subcount').value) || 1;
            if (subCount < 1) subCount = 1;
            return { subCount, weeklyTarget: null };
        }
        if (frequency === 'weekly-count') {
            let weeklyTarget = parseInt(document.getElementById('habit-weekly-target').value) || 1;
            if (weeklyTarget < 1) weeklyTarget = 1;
            return { subCount: 1, weeklyTarget };
        }
        return { subCount: 1, weeklyTarget: null };
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
        const isWeeklyCount = habit.frequency === 'weekly-count';
        const unit = isWeeklyCount ? 'weeks' : 'days';

        let extra = '';
        if (this.isSubdivided(habit)) {
            extra = `Sub-divided: ${habit.subCount}x per day\n`;
        } else if (isWeeklyCount) {
            extra = `Target: ${habit.weeklyTarget}x per week\n`;
        }

        alert(
            `${habit.name}${paused ? ' (Paused)' : ''}\n\n` +
            extra +
            `Current Streak: ${streak.current} ${unit}\n` +
            `Longest Streak: ${streak.longest} ${unit}\n` +
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
