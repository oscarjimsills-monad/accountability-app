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
     * Format date to readable string
     */
    formatDate(date, format = 'short') {
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
     * Get current date string (YYYY-MM-DD)
     */
    getDateString(date = new Date()) {
        // Handle if date is already a string
        if (typeof date === 'string') {
            date = new Date(date);
        }
        // Validate date
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            date = new Date();
        }
        return date.toISOString().split('T')[0];
    },

    /**
     * Get today's date string
     */
    getTodayString() {
        return this.getDateString(new Date());
    },

    /**
     * Get yesterday's date string
     */
    getYesterdayString() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return this.getDateString(yesterday);
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
     * Calculate time difference in minutes
     */
    timeDifferenceMinutes(time1, time2) {
        const minutes1 = this.parseTimeToMinutes(time1);
        const minutes2 = this.parseTimeToMinutes(time2);
        return minutes2 - minutes1;
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
