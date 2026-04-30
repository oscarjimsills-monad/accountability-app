/**
 * Time Tracking Module
 * Handles time tracking for activities
 */

const TimeTracker = {
    timeEntries: [],
    activeTimer: null,

    /**
     * Initialize time tracker
     */
    init() {
        this.loadTimeEntries();
        this.restoreActiveTimer();
    },

    /**
     * Load time entries from storage
     */
    loadTimeEntries() {
        this.timeEntries = StorageManager.getTimeEntries();
        return this.timeEntries;
    },

    /**
     * Save time entries to storage
     */
    saveTimeEntries() {
        return StorageManager.saveTimeEntries(this.timeEntries);
    },

    /**
     * Start timer
     */
    startTimer(activity, category = 'work') {
        if (this.activeTimer) {
            Utils.showWarning('Timer already running. Stop it first.');
            return null;
        }

        this.activeTimer = {
            activity: activity,
            category: category,
            startTime: new Date().toISOString(),
            tempId: Utils.generateId()
        };

        // Save to localStorage for persistence
        localStorage.setItem('activeTimer', JSON.stringify(this.activeTimer));
        
        Utils.showSuccess('Timer started!');
        this.updateTimerDisplay();
        
        return this.activeTimer;
    },

    /**
     * Stop timer
     */
    stopTimer(notes = '') {
        if (!this.activeTimer) {
            Utils.showWarning('No active timer');
            return null;
        }

        const entry = {
            id: Utils.generateId(),
            activity: this.activeTimer.activity,
            category: this.activeTimer.category,
            startTime: this.activeTimer.startTime,
            endTime: new Date().toISOString(),
            duration: this.calculateDuration(this.activeTimer.startTime, new Date().toISOString()),
            notes: notes,
            date: Utils.getDateString(this.activeTimer.startTime)
        };

        this.timeEntries.push(entry);
        this.saveTimeEntries();

        // Clear active timer
        this.activeTimer = null;
        localStorage.removeItem('activeTimer');
        
        Utils.showSuccess(`Tracked ${Utils.formatMinutes(entry.duration)}!`);
        this.updateTimerDisplay();
        
        return entry;
    },

    /**
     * Cancel active timer
     */
    cancelTimer() {
        if (!this.activeTimer) {
            Utils.showWarning('No active timer');
            return false;
        }

        this.activeTimer = null;
        localStorage.removeItem('activeTimer');
        
        Utils.showSuccess('Timer cancelled');
        this.updateTimerDisplay();
        
        return true;
    },

    /**
     * Restore active timer from storage
     */
    restoreActiveTimer() {
        const saved = localStorage.getItem('activeTimer');
        if (saved) {
            try {
                this.activeTimer = JSON.parse(saved);
                this.updateTimerDisplay();
            } catch (error) {
                console.error('Failed to restore timer:', error);
                localStorage.removeItem('activeTimer');
            }
        }
    },

    /**
     * Calculate duration in minutes
     */
    calculateDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return Math.round((end - start) / 1000 / 60);
    },

    /**
     * Get active timer duration
     */
    getActiveTimerDuration() {
        if (!this.activeTimer) return 0;
        return this.calculateDuration(this.activeTimer.startTime, new Date().toISOString());
    },

    /**
     * Create manual time entry
     */
    createEntry(entryData) {
        const entry = {
            id: Utils.generateId(),
            activity: entryData.activity,
            category: entryData.category || 'work',
            startTime: entryData.startTime,
            endTime: entryData.endTime,
            duration: this.calculateDuration(entryData.startTime, entryData.endTime),
            notes: entryData.notes || '',
            date: Utils.getDateString(entryData.startTime)
        };

        this.timeEntries.push(entry);
        this.saveTimeEntries();
        
        Utils.showSuccess('Time entry created!');
        return entry;
    },

    /**
     * Update time entry
     */
    updateEntry(id, updates) {
        const entry = this.timeEntries.find(e => e.id === id);
        if (!entry) {
            Utils.showError('Entry not found');
            return null;
        }

        Object.assign(entry, updates);
        
        // Recalculate duration if times changed
        if (updates.startTime || updates.endTime) {
            entry.duration = this.calculateDuration(entry.startTime, entry.endTime);
        }
        
        this.saveTimeEntries();
        Utils.showSuccess('Entry updated!');
        
        return entry;
    },

    /**
     * Delete time entry
     */
    deleteEntry(id) {
        const index = this.timeEntries.findIndex(e => e.id === id);
        if (index === -1) {
            Utils.showError('Entry not found');
            return false;
        }

        this.timeEntries.splice(index, 1);
        this.saveTimeEntries();
        
        Utils.showSuccess('Entry deleted!');
        return true;
    },

    /**
     * Get entries by date
     */
    getEntriesByDate(date = Utils.getTodayString()) {
        return this.timeEntries.filter(entry => entry.date === date);
    },

    /**
     * Get entries by date range
     */
    getEntriesByDateRange(startDate, endDate) {
        return this.timeEntries.filter(entry => 
            entry.date >= startDate && entry.date <= endDate
        );
    },

    /**
     * Get today's entries
     */
    getTodayEntries() {
        return this.getEntriesByDate(Utils.getTodayString());
    },

    /**
     * Get this week's entries
     */
    getWeekEntries() {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        return this.getEntriesByDateRange(
            Utils.getDateString(startOfWeek),
            Utils.getTodayString()
        );
    },

    /**
     * Calculate total time by category
     */
    getTotalByCategory(entries) {
        const totals = {};
        
        entries.forEach(entry => {
            if (!totals[entry.category]) {
                totals[entry.category] = 0;
            }
            totals[entry.category] += entry.duration;
        });

        return totals;
    },

    /**
     * Get statistics
     */
    getStats(period = 'today') {
        let entries;
        
        switch (period) {
            case 'today':
                entries = this.getTodayEntries();
                break;
            case 'week':
                entries = this.getWeekEntries();
                break;
            default:
                entries = this.timeEntries;
        }

        const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0);
        const byCategory = this.getTotalByCategory(entries);
        
        return {
            totalMinutes,
            totalHours: (totalMinutes / 60).toFixed(1),
            entriesCount: entries.length,
            byCategory,
            averagePerDay: period === 'week' ? Math.round(totalMinutes / 7) : totalMinutes
        };
    },

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        // This will be called by the UI to update the timer display
        if (window.App && window.App.updateTimerDisplay) {
            window.App.updateTimerDisplay();
        }
    },

    /**
     * Render time entries list
     */
    renderEntriesList(containerId, entries = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const entriesToShow = entries || this.getTodayEntries();

        if (entriesToShow.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No time entries yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = entriesToShow.map(entry => this.renderEntryCard(entry)).join('');
    },

    /**
     * Render entry card
     */
    renderEntryCard(entry) {
        return `
            <div class="time-entry-card" data-entry-id="${entry.id}">
                <div class="entry-header">
                    <div class="entry-info">
                        <h4 class="entry-activity">${Utils.escapeHtml(entry.activity)}</h4>
                        <span class="entry-category">${entry.category}</span>
                    </div>
                    <span class="entry-duration">${Utils.formatMinutes(entry.duration)}</span>
                </div>
                
                <div class="entry-time">
                    ${Utils.formatTime(entry.startTime)} - ${Utils.formatTime(entry.endTime)}
                </div>
                
                ${entry.notes ? `<p class="entry-notes">${Utils.escapeHtml(entry.notes)}</p>` : ''}
                
                <div class="entry-actions">
                    <button class="btn-icon" onclick="TimeTracker.showEditEntryModal('${entry.id}')" title="Edit">
                        ✏️
                    </button>
                    <button class="btn-icon" onclick="TimeTracker.confirmDeleteEntry('${entry.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Show create entry modal
     */
    showCreateEntryModal() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="TimeTracker.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Add Time Entry</h2>
                        <button class="btn-close" onclick="TimeTracker.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="entry-form" onsubmit="TimeTracker.handleCreateEntry(event)">
                            <div class="form-group">
                                <label for="entry-activity">Activity *</label>
                                <input type="text" id="entry-activity" class="input-text" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="entry-category">Category</label>
                                <select id="entry-category" class="input-select">
                                    <option value="work">Work</option>
                                    <option value="personal">Personal</option>
                                    <option value="learning">Learning</option>
                                    <option value="exercise">Exercise</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="entry-start">Start Time *</label>
                                    <input type="datetime-local" id="entry-start" class="input-datetime" 
                                           value="${oneHourAgo.toISOString().slice(0, 16)}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="entry-end">End Time *</label>
                                    <input type="datetime-local" id="entry-end" class="input-datetime" 
                                           value="${now.toISOString().slice(0, 16)}" required>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="entry-notes">Notes</label>
                                <textarea id="entry-notes" class="input-textarea" rows="2"></textarea>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="TimeTracker.closeModal()">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    Add Entry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    },

    /**
     * Show edit entry modal
     */
    showEditEntryModal(entryId) {
        const entry = this.timeEntries.find(e => e.id === entryId);
        if (!entry) return;

        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="TimeTracker.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Edit Time Entry</h2>
                        <button class="btn-close" onclick="TimeTracker.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="entry-form" onsubmit="TimeTracker.handleEditEntry(event, '${entryId}')">
                            <div class="form-group">
                                <label for="entry-activity">Activity *</label>
                                <input type="text" id="entry-activity" class="input-text" value="${Utils.escapeHtml(entry.activity)}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="entry-category">Category</label>
                                <select id="entry-category" class="input-select">
                                    <option value="work" ${entry.category === 'work' ? 'selected' : ''}>Work</option>
                                    <option value="personal" ${entry.category === 'personal' ? 'selected' : ''}>Personal</option>
                                    <option value="learning" ${entry.category === 'learning' ? 'selected' : ''}>Learning</option>
                                    <option value="exercise" ${entry.category === 'exercise' ? 'selected' : ''}>Exercise</option>
                                    <option value="other" ${entry.category === 'other' ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="entry-start">Start Time *</label>
                                    <input type="datetime-local" id="entry-start" class="input-datetime"
                                           value="${this.formatDatetimeLocal(entry.startTime)}" required>
                                </div>
                                
                                <div class="form-group">
                                    <label for="entry-end">End Time *</label>
                                    <input type="datetime-local" id="entry-end" class="input-datetime"
                                           value="${this.formatDatetimeLocal(entry.endTime)}" required>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="entry-notes">Notes</label>
                                <textarea id="entry-notes" class="input-textarea" rows="2">${Utils.escapeHtml(entry.notes)}</textarea>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="TimeTracker.closeModal()">
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
        modal.style.display = 'flex';
    },

    /**
     * Handle create entry form submission
     */
    handleCreateEntry(event) {
        event.preventDefault();

        const entryData = {
            activity: document.getElementById('entry-activity').value.trim(),
            category: document.getElementById('entry-category').value,
            startTime: new Date(document.getElementById('entry-start').value).toISOString(),
            endTime: new Date(document.getElementById('entry-end').value).toISOString(),
            notes: document.getElementById('entry-notes').value.trim()
        };

        // Validate times
        if (entryData.endTime <= entryData.startTime) {
            Utils.showError('End time must be after start time');
            return;
        }

        this.createEntry(entryData);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Handle edit entry form submission
     */
    handleEditEntry(event, entryId) {
        event.preventDefault();

        const updates = {
            activity: document.getElementById('entry-activity').value.trim(),
            category: document.getElementById('entry-category').value,
            startTime: new Date(document.getElementById('entry-start').value).toISOString(),
            endTime: new Date(document.getElementById('entry-end').value).toISOString(),
            notes: document.getElementById('entry-notes').value.trim()
        };

        // Validate times
        if (updates.endTime <= updates.startTime) {
            Utils.showError('End time must be after start time');
            return;
        }

        this.updateEntry(entryId, updates);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Confirm delete entry
     */
    confirmDeleteEntry(entryId) {
        if (confirm('Delete this time entry?')) {
            this.deleteEntry(entryId);
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
     * Format datetime for datetime-local input (in local timezone)
     */
    formatDatetimeLocal(isoString) {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
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

// Make TimeTracker available globally
window.TimeTracker = TimeTracker;

// Made with Bob