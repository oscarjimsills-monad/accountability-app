/**
 * Storage Manager
 * Handles all localStorage operations with error handling
 */

const STORAGE_KEYS = {
    TASKS: 'accountability_tasks',
    HABITS: 'accountability_habits',
    GOALS: 'accountability_goals',
    TIME_ENTRIES: 'accountability_timeEntries',
    REFLECTIONS: 'accountability_reflections',
    COMMITMENTS: 'accountability_commitments',
    SETTINGS: 'accountability_settings',
    LAST_CHECKIN: 'accountability_lastCheckin',
    LAST_EVENING_CHECKIN: 'accountability_lastEveningCheckin',
    USER_NAME: 'accountability_userName'
};

const StorageManager = {
    /**
     * Save data to localStorage
     */
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Storage save error:', error);
            if (error.name === 'QuotaExceededError') {
                Utils.showError('Storage quota exceeded. Please export and clear old data.');
            } else {
                Utils.showError('Failed to save data.');
            }
            return false;
        }
    },

    /**
     * Load data from localStorage
     */
    load(key) {
        try {
            const serialized = localStorage.getItem(key);
            return serialized ? JSON.parse(serialized) : null;
        } catch (error) {
            console.error('Storage load error:', error);
            Utils.showError('Failed to load data.');
            return null;
        }
    },

    /**
     * Remove item from localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },

    /**
     * Clear all app data
     */
    clear() {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    },

    /**
     * Get all tasks
     */
    getTasks() {
        return this.load(STORAGE_KEYS.TASKS) || [];
    },

    /**
     * Save tasks
     */
    saveTasks(tasks) {
        return this.save(STORAGE_KEYS.TASKS, tasks);
    },

    /**
     * Get all habits
     */
    getHabits() {
        return this.load(STORAGE_KEYS.HABITS) || [];
    },

    /**
     * Save habits
     */
    saveHabits(habits) {
        return this.save(STORAGE_KEYS.HABITS, habits);
    },

    /**
     * Get all goals
     */
    getGoals() {
        return this.load(STORAGE_KEYS.GOALS) || [];
    },

    /**
     * Save goals
     */
    saveGoals(goals) {
        return this.save(STORAGE_KEYS.GOALS, goals);
    },

    /**
     * Get all time entries
     */
    getTimeEntries() {
        return this.load(STORAGE_KEYS.TIME_ENTRIES) || [];
    },

    /**
     * Save time entries
     */
    saveTimeEntries(entries) {
        return this.save(STORAGE_KEYS.TIME_ENTRIES, entries);
    },

    /**
     * Get all reflections
     */
    getReflections() {
        return this.load(STORAGE_KEYS.REFLECTIONS) || [];
    },

    /**
     * Save reflections
     */
    saveReflections(reflections) {
        return this.save(STORAGE_KEYS.REFLECTIONS, reflections);
    },

    /**
     * Get commitments for a specific date
     */
    getCommitments(date = Utils.getTodayString()) {
        const allCommitments = this.load(STORAGE_KEYS.COMMITMENTS) || {};
        return allCommitments[date] || null;
    },

    /**
     * Save commitments for a specific date
     */
    saveCommitments(date, commitments) {
        const allCommitments = this.load(STORAGE_KEYS.COMMITMENTS) || {};
        allCommitments[date] = commitments;
        return this.save(STORAGE_KEYS.COMMITMENTS, allCommitments);
    },

    /**
     * Get all commitments
     */
    getAllCommitments() {
        return this.load(STORAGE_KEYS.COMMITMENTS) || {};
    },

    /**
     * Get settings
     */
    getSettings() {
        const defaults = {
            theme: 'light',
            notifications: true,
            startOfWeek: 0, // Sunday
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '12h',
            gracePeriodMinutes: 15
        };
        return { ...defaults, ...this.load(STORAGE_KEYS.SETTINGS) };
    },

    /**
     * Save settings
     */
    saveSettings(settings) {
        return this.save(STORAGE_KEYS.SETTINGS, settings);
    },

    /**
     * Get last check-in date
     */
    getLastCheckin() {
        return this.load(STORAGE_KEYS.LAST_CHECKIN);
    },

    /**
     * Save last check-in date
     */
    saveLastCheckin(date = Utils.getTodayString()) {
        return this.save(STORAGE_KEYS.LAST_CHECKIN, date);
    },

    /**
     * Get last evening check-in date
     */
    getLastEveningCheckin() {
        return this.load(STORAGE_KEYS.LAST_EVENING_CHECKIN);
    },

    /**
     * Save last evening check-in date
     */
    saveLastEveningCheckin(date = Utils.getTodayString()) {
        return this.save(STORAGE_KEYS.LAST_EVENING_CHECKIN, date);
    },

    /**
     * Get user name
     */
    getUserName() {
        return this.load(STORAGE_KEYS.USER_NAME) || 'there';
    },

    /**
     * Save user name
     */
    saveUserName(name) {
        return this.save(STORAGE_KEYS.USER_NAME, name);
    },

    /**
     * Export all data
     */
    exportAll() {
        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            data: {
                tasks: this.getTasks(),
                habits: this.getHabits(),
                goals: this.getGoals(),
                timeEntries: this.getTimeEntries(),
                reflections: this.getReflections(),
                commitments: this.getAllCommitments(),
                settings: this.getSettings(),
                userName: this.getUserName()
            }
        };
        return data;
    },

    /**
     * Import data
     */
    importAll(data) {
        try {
            if (!data || !data.data) {
                throw new Error('Invalid data format');
            }

            const { tasks, habits, goals, timeEntries, reflections, commitments, settings, userName } = data.data;

            if (tasks) this.saveTasks(tasks);
            if (habits) this.saveHabits(habits);
            if (goals) this.saveGoals(goals);
            if (timeEntries) this.saveTimeEntries(timeEntries);
            if (reflections) this.saveReflections(reflections);
            if (commitments) this.save(STORAGE_KEYS.COMMITMENTS, commitments);
            if (settings) this.saveSettings(settings);
            if (userName) this.saveUserName(userName);

            return true;
        } catch (error) {
            console.error('Import error:', error);
            Utils.showError('Failed to import data: ' + error.message);
            return false;
        }
    },

    /**
     * Get storage usage info
     */
    getStorageInfo() {
        let totalSize = 0;
        const info = {};

        Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
            const data = localStorage.getItem(key);
            const size = data ? new Blob([data]).size : 0;
            info[name] = {
                size: size,
                sizeKB: (size / 1024).toFixed(2)
            };
            totalSize += size;
        });

        return {
            items: info,
            totalSize: totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
        };
    },

    /**
     * Check if storage is available
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }
};

// Make StorageManager available globally
window.StorageManager = StorageManager;
window.STORAGE_KEYS = STORAGE_KEYS;

// Made with Bob
