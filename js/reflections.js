/**
 * Reflections Module
 * Handles daily reflections and journaling
 */

const ReflectionManager = {
    reflections: [],

    /**
     * Initialize reflection manager
     */
    init() {
        this.loadReflections();
    },

    /**
     * Load reflections from storage
     */
    loadReflections() {
        this.reflections = StorageManager.load('accountability_reflections') || [];
        return this.reflections;
    },

    /**
     * Save reflections to storage
     */
    saveReflections() {
        return StorageManager.save('accountability_reflections', this.reflections);
    },

    /**
     * Add a new reflection
     */
    addReflection(content, date = Utils.getTodayString()) {
        const reflection = {
            id: Utils.generateId(),
            content: content,
            date: date,
            createdAt: new Date().toISOString()
        };

        this.reflections.push(reflection);
        this.saveReflections();
        
        Utils.showSuccess('Reflection saved!');
        return reflection;
    },

    /**
     * Get reflection by ID
     */
    getReflection(id) {
        return this.reflections.find(r => r.id === id);
    },

    /**
     * Get reflections for a specific date
     */
    getReflectionsByDate(date) {
        return this.reflections.filter(r => r.date === date);
    },

    /**
     * Get all reflections sorted by date (newest first)
     */
    getAllReflections() {
        return [...this.reflections].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    },

    /**
     * Update reflection
     */
    updateReflection(id, content) {
        const reflection = this.getReflection(id);
        if (!reflection) {
            Utils.showError('Reflection not found');
            return null;
        }

        reflection.content = content;
        reflection.updatedAt = new Date().toISOString();
        this.saveReflections();
        
        Utils.showSuccess('Reflection updated!');
        return reflection;
    },

    /**
     * Delete reflection
     */
    deleteReflection(id) {
        const index = this.reflections.findIndex(r => r.id === id);
        if (index === -1) {
            Utils.showError('Reflection not found');
            return false;
        }

        this.reflections.splice(index, 1);
        this.saveReflections();
        
        Utils.showSuccess('Reflection deleted!');
        return true;
    },

    /**
     * Get statistics
     */
    getStats() {
        const total = this.reflections.length;
        const dates = [...new Set(this.reflections.map(r => r.date))];
        const daysWithReflections = dates.length;
        
        // Calculate streak
        let currentStreak = 0;
        let checkDate = new Date();
        
        for (let i = 0; i < 365; i++) {
            const dateStr = Utils.getDateString(checkDate);
            const hasReflection = this.reflections.some(r => r.date === dateStr);
            
            if (hasReflection) {
                currentStreak++;
            } else if (i > 0) {
                break;
            }
            
            checkDate.setDate(checkDate.getDate() - 1);
        }

        return {
            total,
            daysWithReflections,
            currentStreak
        };
    }
};

// Make ReflectionManager available globally
window.ReflectionManager = ReflectionManager;

// Made with Bob