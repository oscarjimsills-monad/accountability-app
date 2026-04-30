/**
 * Screentime Tracker Module
 * Tracks daily screentime and analyzes patterns
 */

const ScreentimeTracker = {
    entries: [],

    /**
     * Initialize screentime tracker
     */
    init() {
        this.loadEntries();
    },

    /**
     * Load entries from storage
     */
    loadEntries() {
        this.entries = StorageManager.load('accountability_screentime') || [];
        return this.entries;
    },

    /**
     * Save entries to storage
     */
    saveEntries() {
        return StorageManager.save('accountability_screentime', this.entries);
    },

    /**
     * Add screentime entry
     */
    addEntry(date, hours, minutes, notes = '') {
        const totalMinutes = (hours * 60) + minutes;
        const dateStr = date || Utils.getTodayString();
        
        // Check if entry exists for this date
        const existingIndex = this.entries.findIndex(e => e.date === dateStr);
        
        if (existingIndex > -1) {
            // Update existing entry
            this.entries[existingIndex].totalMinutes = totalMinutes;
            this.entries[existingIndex].notes = notes;
            this.entries[existingIndex].updatedAt = new Date().toISOString();
        } else {
            // Create new entry
            const entry = {
                id: Utils.generateId(),
                date: dateStr,
                totalMinutes: totalMinutes,
                notes: notes,
                createdAt: new Date().toISOString()
            };
            this.entries.push(entry);
        }
        
        this.saveEntries();
        Utils.showSuccess('Screentime logged!');
        
        return this.getEntry(dateStr);
    },

    /**
     * Get entry by date
     */
    getEntry(date) {
        return this.entries.find(e => e.date === date);
    },

    /**
     * Get today's entry
     */
    getTodayEntry() {
        return this.getEntry(Utils.getTodayString());
    },

    /**
     * Delete entry
     */
    deleteEntry(date) {
        const index = this.entries.findIndex(e => e.date === date);
        if (index > -1) {
            this.entries.splice(index, 1);
            this.saveEntries();
            Utils.showSuccess('Entry deleted!');
            return true;
        }
        return false;
    },

    /**
     * Get entries for date range
     */
    getEntriesInRange(startDate, endDate) {
        return this.entries.filter(e => e.date >= startDate && e.date <= endDate)
            .sort((a, b) => a.date.localeCompare(b.date));
    },

    /**
     * Get last N days of entries
     */
    getLastNDays(days = 7) {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (days - 1));
        
        return this.getEntriesInRange(
            Utils.getDateString(startDate),
            Utils.getTodayString()
        );
    },

    /**
     * Calculate statistics
     */
    getStats(days = 7) {
        const entries = this.getLastNDays(days);
        
        if (entries.length === 0) {
            return {
                average: 0,
                total: 0,
                highest: 0,
                lowest: 0,
                trend: 'no_data',
                daysLogged: 0,
                totalDays: days
            };
        }

        const totalMinutes = entries.reduce((sum, e) => sum + e.totalMinutes, 0);
        const average = Math.round(totalMinutes / entries.length);
        const highest = Math.max(...entries.map(e => e.totalMinutes));
        const lowest = Math.min(...entries.map(e => e.totalMinutes));
        
        // Calculate trend (comparing first half to second half)
        const midpoint = Math.floor(entries.length / 2);
        const firstHalf = entries.slice(0, midpoint);
        const secondHalf = entries.slice(midpoint);
        
        const firstAvg = firstHalf.reduce((sum, e) => sum + e.totalMinutes, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, e) => sum + e.totalMinutes, 0) / secondHalf.length;
        
        let trend = 'stable';
        const difference = secondAvg - firstAvg;
        if (difference > 30) trend = 'increasing';
        else if (difference < -30) trend = 'decreasing';

        return {
            average,
            total: totalMinutes,
            highest,
            lowest,
            trend,
            daysLogged: entries.length,
            totalDays: days,
            entries
        };
    },

    /**
     * Analyze patterns
     */
    analyzePatterns(days = 30) {
        const entries = this.getLastNDays(days);
        
        if (entries.length < 7) {
            return {
                hasEnoughData: false,
                message: 'Need at least 7 days of data for pattern analysis'
            };
        }

        const stats = this.getStats(days);
        const patterns = [];
        const recommendations = [];

        // Analyze average screentime
        const avgHours = stats.average / 60;
        if (avgHours > 8) {
            patterns.push({
                type: 'warning',
                title: 'Very High Screentime',
                description: `Your average is ${avgHours.toFixed(1)} hours/day. This is significantly above recommended levels.`
            });
            recommendations.push('Consider setting a daily limit of 6 hours or less');
            recommendations.push('Take regular breaks every hour');
        } else if (avgHours > 6) {
            patterns.push({
                type: 'caution',
                title: 'High Screentime',
                description: `Your average is ${avgHours.toFixed(1)} hours/day. There\'s room for improvement.`
            });
            recommendations.push('Try to reduce by 30 minutes each week');
        } else if (avgHours > 4) {
            patterns.push({
                type: 'info',
                title: 'Moderate Screentime',
                description: `Your average is ${avgHours.toFixed(1)} hours/day. This is reasonable but could be optimized.`
            });
        } else {
            patterns.push({
                type: 'success',
                title: 'Good Screentime',
                description: `Your average is ${avgHours.toFixed(1)} hours/day. You\'re doing well!`
            });
        }

        // Analyze trend
        if (stats.trend === 'increasing') {
            patterns.push({
                type: 'warning',
                title: 'Increasing Trend',
                description: 'Your screentime has been increasing recently.'
            });
            recommendations.push('Identify what\'s causing the increase');
            recommendations.push('Set stricter boundaries');
        } else if (stats.trend === 'decreasing') {
            patterns.push({
                type: 'success',
                title: 'Decreasing Trend',
                description: 'Great! Your screentime is going down.'
            });
            recommendations.push('Keep up the good work!');
        }

        // Analyze consistency
        const variance = this.calculateVariance(entries.map(e => e.totalMinutes));
        const stdDev = Math.sqrt(variance);
        
        if (stdDev > 120) { // More than 2 hours variation
            patterns.push({
                type: 'info',
                title: 'Inconsistent Usage',
                description: 'Your screentime varies significantly day to day.'
            });
            recommendations.push('Try to maintain more consistent daily limits');
        }

        // Day of week patterns (if enough data)
        if (entries.length >= 14) {
            const dayPatterns = this.analyzeDayOfWeekPatterns(entries);
            if (dayPatterns.highestDay) {
                patterns.push({
                    type: 'info',
                    title: 'Day Pattern Detected',
                    description: `You tend to use screens more on ${dayPatterns.highestDay}s (${(dayPatterns.highestAvg / 60).toFixed(1)}h avg).`
                });
            }
        }

        return {
            hasEnoughData: true,
            stats,
            patterns,
            recommendations,
            insights: this.generateInsights(stats, patterns)
        };
    },

    /**
     * Calculate variance
     */
    calculateVariance(values) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squareDiffs = values.map(val => Math.pow(val - avg, 2));
        return squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    },

    /**
     * Analyze day of week patterns
     */
    analyzeDayOfWeekPatterns(entries) {
        const dayTotals = {};
        const dayCounts = {};
        
        entries.forEach(entry => {
            const date = new Date(entry.date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            
            if (!dayTotals[dayName]) {
                dayTotals[dayName] = 0;
                dayCounts[dayName] = 0;
            }
            
            dayTotals[dayName] += entry.totalMinutes;
            dayCounts[dayName]++;
        });

        const dayAverages = {};
        Object.keys(dayTotals).forEach(day => {
            dayAverages[day] = dayTotals[day] / dayCounts[day];
        });

        const sortedDays = Object.entries(dayAverages).sort((a, b) => b[1] - a[1]);
        
        return {
            highestDay: sortedDays[0]?.[0],
            highestAvg: sortedDays[0]?.[1],
            lowestDay: sortedDays[sortedDays.length - 1]?.[0],
            lowestAvg: sortedDays[sortedDays.length - 1]?.[1],
            allDays: dayAverages
        };
    },

    /**
     * Generate insights
     */
    generateInsights(stats, patterns) {
        const insights = [];
        const avgHours = stats.average / 60;

        // Compare to goals
        const idealHours = 4; // Recommended max
        if (avgHours > idealHours) {
            const excess = avgHours - idealHours;
            insights.push(`You're spending ${excess.toFixed(1)} hours more than the recommended ${idealHours} hours/day`);
        }

        // Weekly total
        const weeklyHours = (stats.average * 7) / 60;
        insights.push(`That's ${weeklyHours.toFixed(1)} hours per week`);

        // Monthly projection
        const monthlyHours = (stats.average * 30) / 60;
        insights.push(`Projected monthly total: ${monthlyHours.toFixed(0)} hours`);

        return insights;
    },

    /**
     * Get goal suggestions
     */
    getGoalSuggestions() {
        const stats = this.getStats(7);
        const avgHours = stats.average / 60;
        
        const suggestions = [];
        
        if (avgHours > 8) {
            suggestions.push({ target: 7, description: 'Reduce to 7 hours/day (1 hour reduction)' });
            suggestions.push({ target: 6, description: 'Reduce to 6 hours/day (2 hour reduction)' });
        } else if (avgHours > 6) {
            suggestions.push({ target: 5, description: 'Reduce to 5 hours/day' });
            suggestions.push({ target: 4, description: 'Reduce to 4 hours/day (recommended)' });
        } else if (avgHours > 4) {
            suggestions.push({ target: 4, description: 'Reduce to 4 hours/day (recommended)' });
            suggestions.push({ target: 3, description: 'Reduce to 3 hours/day (optimal)' });
        } else {
            suggestions.push({ target: avgHours, description: 'Maintain current level' });
            suggestions.push({ target: 3, description: 'Aim for 3 hours/day (optimal)' });
        }

        return suggestions;
    },

    /**
     * Calculate streak for staying under goal (1.5 hours = 90 minutes)
     */
    getStreak(goalMinutes = 90) {
        const sortedEntries = [...this.entries]
            .sort((a, b) => b.date.localeCompare(a.date));
        
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let lastDate = null;
        
        // Calculate current streak (from today backwards)
        const today = Utils.getTodayString();
        let checkDate = new Date();
        
        for (let i = 0; i < 365; i++) { // Check up to a year
            const dateStr = Utils.getDateString(checkDate);
            const entry = this.entries.find(e => e.date === dateStr);
            
            if (entry && entry.totalMinutes <= goalMinutes) {
                if (dateStr === today || (lastDate && this.isConsecutiveDay(dateStr, lastDate))) {
                    currentStreak++;
                    lastDate = dateStr;
                } else {
                    break;
                }
            } else if (dateStr === today || (lastDate && this.isConsecutiveDay(dateStr, lastDate))) {
                // Entry exists but over goal, or no entry for consecutive day
                break;
            }
            
            checkDate.setDate(checkDate.getDate() - 1);
        }
        
        // Calculate longest streak
        sortedEntries.forEach((entry, index) => {
            if (entry.totalMinutes <= goalMinutes) {
                tempStreak++;
                
                // Check if next entry is consecutive
                if (index < sortedEntries.length - 1) {
                    const nextEntry = sortedEntries[index + 1];
                    if (!this.isConsecutiveDay(nextEntry.date, entry.date)) {
                        longestStreak = Math.max(longestStreak, tempStreak);
                        tempStreak = 0;
                    }
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                }
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
            }
        });
        
        return {
            current: currentStreak,
            longest: longestStreak,
            goalMinutes: goalMinutes
        };
    },

    /**
     * Check if two dates are consecutive days
     */
    isConsecutiveDay(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1;
    }
};

// Make ScreentimeTracker available globally
window.ScreentimeTracker = ScreentimeTracker;

// Made with Bob