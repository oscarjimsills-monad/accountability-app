/**
 * Utility Functions
 * Common helper functions used throughout the app
 */

const Utils = {
    /**
     * Generate a unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Format date to readable string.
     *
     * If given a bare YYYY-MM-DD string, anchor to local noon before
     * constructing the Date — otherwise it parses as UTC midnight, which
     * toLocaleDateString then renders through the local timezone, silently
     * shifting the displayed day (and weekday name) back one day for any
     * timezone behind UTC.
     */
    formatDate(date, format = 'short') {
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            date = date + 'T12:00:00';
        }
        const d = new Date(date);
        const options = format === 'short'
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return d.toLocaleDateString('en-US', options);
    },

    /**
     * Format time to readable string
     */
    formatTime(date) {
        const d = new Date(date);
        return d.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    },

    /**
     * Convert an ISO timestamp into a short relative "time ago" string.
     */
    timeAgo(isoString) {
        if (!isoString) return null;
        const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
        if (diffSec < 10) return 'just now';
        if (diffSec < 60) return `${diffSec}s ago`;
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        return `${diffDay}d ago`;
    },

    /**
     * Format time from HH:MM string
     */
    formatTimeString(timeStr) {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    },

    /**
     * Format a date as YYYY-MM-DD using LOCAL calendar fields (not UTC —
     * toISOString() converts to UTC first, which silently shifts the date
     * across timezone boundaries depending on time of day).
     */
    getDateString(date = new Date()) {
        // Already a plain YYYY-MM-DD string — return as-is. Parsing this into
        // a Date would treat it as UTC midnight (per the ISO spec for
        // date-only strings), and reading local fields back off that can
        // shift it a day in the other direction for timezones behind UTC.
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
        }
        if (typeof date === 'string') {
            date = new Date(date);
        }
        // Validate date
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            date = new Date();
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },


    /**
     * Get yesterday's date string (respects 5am day boundary)
     */
    getYesterdayString() {
        const logDate = this.getLogDateString();
        const yesterday = new Date(logDate);
        yesterday.setDate(yesterday.getDate() - 1);
        return this.getDateString(yesterday);
    },

    /**
     * Get current log date string (respects 5am day boundary)
     */
    getLogDateString() {
        const now = new Date();
        const hour = now.getHours();
        // If before 5am, the log date is still "yesterday" (the previous calendar day)
        if (hour < 5) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            // Use local date formatting instead of UTC
            const year = yesterday.getFullYear();
            const month = String(yesterday.getMonth() + 1).padStart(2, '0');
            const day = String(yesterday.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        // Use local date formatting instead of UTC
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    /**
     * Check if date is today
     */
    isToday(date) {
        const d = new Date(date);
        const today = new Date();
        return d.toDateString() === today.toDateString();
    },

    /**
     * Check if date is yesterday
     */
    isYesterday(date) {
        const d = new Date(date);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return d.toDateString() === yesterday.toDateString();
    },

    /**
     * Calculate days between two dates
     */
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Get start of day
     */
    getStartOfDay(date = new Date()) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    },

    /**
     * Get end of day
     */
    getEndOfDay(date = new Date()) {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
    },

    /**
     * Parse time string (HH:MM) to minutes since midnight
     */
    parseTimeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    },

    /**
     * Calculate time difference in minutes (time2 - time1), handling midnight
     * wraparound. Without this, a bedtime commitment of 23:00 with an actual
     * bedtime of 00:30 computes as -1350 minutes (since 00:30 is numerically
     * "earlier" in minutes-since-midnight) instead of +90 minutes late — the
     * single most common way a bedtime commitment actually gets missed.
     */
    timeDifferenceMinutes(time1, time2) {
        const minutes1 = this.parseTimeToMinutes(time1);
        const minutes2 = this.parseTimeToMinutes(time2);
        let diff = minutes2 - minutes1;
        // If time2 looks like it's more than 12 hours "before" time1, it's far
        // more likely time2 actually fell on the next calendar day.
        if (diff < -720) diff += 1440;
        return diff;
    },

    /**
     * Format minutes to hours and minutes
     */
    formatMinutes(minutes) {
        const hours = Math.floor(Math.abs(minutes) / 60);
        const mins = Math.abs(minutes) % 60;
        const sign = minutes < 0 ? '-' : '';
        
        if (hours === 0) {
            return `${sign}${mins} min`;
        } else if (mins === 0) {
            return `${sign}${hours} hr`;
        } else {
            return `${sign}${hours} hr ${mins} min`;
        }
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Sanitize input
     */
    sanitizeInput(input) {
        return this.escapeHtml(input.trim());
    },

    /**
     * Get greeting based on time of day
     */
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    },

    /**
     * Get time of day category
     */
    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 21) return 'evening';
        return 'night';
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Show error toast
     */
    showError(message, duration = 3000) {
        this.showToast(message, 'error', duration);
    },

    /**
     * Show success toast
     */
    showSuccess(message, duration = 2000) {
        this.showToast(message, 'success', duration);
    },

    /**
     * Show warning toast
     */
    showWarning(message, duration = 3000) {
        this.showToast(message, 'warning', duration);
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Calculate percentage
     */
    calculatePercentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    },

    /**
     * Get emoji for mood
     */
    getMoodEmoji(mood) {
        const moods = {
            great: '😄',
            good: '🙂',
            okay: '😐',
            bad: '😟',
            terrible: '😢'
        };
        return moods[mood] || '😐';
    },

    /**
     * Get color for priority
     */
    getPriorityColor(priority) {
        const colors = {
            high: '#F44336',
            medium: '#FF9800',
            low: '#4CAF50'
        };
        return colors[priority] || colors.medium;
    },

    /**
     * Shuffle array
     */
    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    /**
     * Get random item from array
     */
    randomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * Validate email
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Validate time format (HH:MM)
     */
    isValidTime(time) {
        const re = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return re.test(time);
    },

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * Truncate text
     */
    truncate(text, length = 50) {
        if (text.length <= length) return text;
        return text.substr(0, length) + '...';
    },

    /**
     * Get ordinal suffix for number (1st, 2nd, 3rd, etc.)
     */
    getOrdinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },

    /**
     * Sleep/delay function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Make Utils available globally
window.Utils = Utils;

// Made with Bob
