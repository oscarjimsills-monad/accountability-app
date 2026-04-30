/**
 * Commitment Tracker
 * Tracks wake-up time, bedtime, and obligations commitments
 */

const CommitmentTracker = {
    /**
     * Set a commitment for a specific date
     */
    setCommitment(type, value, date = Utils.getTodayString()) {
        const commitments = StorageManager.getCommitments(date) || this.createEmptyCommitment(date);
        
        if (type === 'wakeup') {
            commitments.wakeup.commitment = value;
            commitments.wakeup.timestamp = new Date().toISOString();
        } else if (type === 'bedtime') {
            commitments.bedtime.commitment = value;
            commitments.bedtime.timestamp = new Date().toISOString();
        } else if (type === 'obligations') {
            commitments.obligations = value;
        } else if (type === 'priorities') {
            commitments.priorities = value;
        }
        
        StorageManager.saveCommitments(date, commitments);
        return commitments;
    },

    /**
     * Check/record actual value for a commitment
     */
    checkCommitment(type, actual, date = Utils.getTodayString(), excuse = null) {
        const commitments = StorageManager.getCommitments(date);
        if (!commitments) return null;
        
        if (type === 'wakeup') {
            const commitment = commitments.wakeup.commitment;
            const minutesLate = Utils.timeDifferenceMinutes(commitment, actual);
            const gracePeriod = StorageManager.getSettings().gracePeriodMinutes || 15;
            const met = minutesLate <= gracePeriod;
            
            commitments.wakeup.actual = actual;
            commitments.wakeup.met = met;
            commitments.wakeup.minutesLate = Math.max(0, minutesLate);
            commitments.wakeup.excuse = excuse;
            commitments.wakeup.checkedAt = new Date().toISOString();
            
            // Update streak
            const streak = this.calculateWakeupStreak(date);
            commitments.wakeup.streak = streak.current;
            commitments.wakeup.previousStreak = streak.previous;
            
        } else if (type === 'bedtime') {
            const commitment = commitments.bedtime.commitment;
            const minutesLate = Utils.timeDifferenceMinutes(commitment, actual);
            const met = minutesLate <= 30; // 30 min grace for bedtime
            
            commitments.bedtime.actual = actual;
            commitments.bedtime.met = met;
            commitments.bedtime.minutesLate = Math.max(0, minutesLate);
            commitments.bedtime.checkedAt = new Date().toISOString();
        }
        
        StorageManager.saveCommitments(date, commitments);
        return commitments;
    },

    /**
     * Update obligation status
     */
    updateObligation(date, obligationIndex, completed, reason = null) {
        const commitments = StorageManager.getCommitments(date);
        if (!commitments || !commitments.obligations[obligationIndex]) return null;
        
        commitments.obligations[obligationIndex].completed = completed;
        commitments.obligations[obligationIndex].reason = reason;
        commitments.obligations[obligationIndex].completedAt = new Date().toISOString();
        
        // Calculate completion rate
        const total = commitments.obligations.length;
        const completed_count = commitments.obligations.filter(o => o.completed).length;
        commitments.completionRate = Utils.calculatePercentage(completed_count, total);
        
        StorageManager.saveCommitments(date, commitments);
        return commitments;
    },

    /**
     * Update priority status
     */
    updatePriority(date, priorityIndex, completed) {
        const commitments = StorageManager.getCommitments(date);
        if (!commitments || !commitments.priorities[priorityIndex]) return null;
        
        commitments.priorities[priorityIndex].completed = completed;
        commitments.priorities[priorityIndex].completedAt = new Date().toISOString();
        
        StorageManager.saveCommitments(date, commitments);
        return commitments;
    },

    /**
     * Create empty commitment structure
     */
    createEmptyCommitment(date) {
        return {
            date: date,
            wakeup: {
                commitment: null,
                actual: null,
                met: null,
                minutesLate: 0,
                excuse: null,
                streak: 0,
                previousStreak: 0,
                timestamp: null,
                checkedAt: null
            },
            bedtime: {
                commitment: null,
                actual: null,
                met: null,
                minutesLate: 0,
                timestamp: null,
                checkedAt: null
            },
            obligations: [],
            priorities: [],
            completionRate: 0,
            mood: null,
            reflection: null
        };
    },

    /**
     * Calculate wake-up streak
     */
    calculateWakeupStreak(endDate = Utils.getTodayString()) {
        const allCommitments = StorageManager.getAllCommitments();
        const dates = Object.keys(allCommitments).sort().reverse();
        
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let previousStreak = 0;
        let foundBreak = false;
        
        for (const date of dates) {
            const commitment = allCommitments[date];
            
            if (commitment.wakeup && commitment.wakeup.met !== null) {
                if (commitment.wakeup.met) {
                    if (!foundBreak) {
                        currentStreak++;
                    }
                    tempStreak++;
                    longestStreak = Math.max(longestStreak, tempStreak);
                } else {
                    if (!foundBreak && currentStreak > 0) {
                        previousStreak = currentStreak;
                        foundBreak = true;
                    }
                    if (tempStreak > 0) {
                        longestStreak = Math.max(longestStreak, tempStreak);
                        tempStreak = 0;
                    }
                }
            }
            
            // Stop after checking enough history
            if (date < endDate && foundBreak) break;
        }
        
        return {
            current: currentStreak,
            longest: longestStreak,
            previous: previousStreak
        };
    },

    /**
     * Calculate weekly wake-up score
     */
    calculateWeeklyScore(endDate = Utils.getTodayString()) {
        const allCommitments = StorageManager.getAllCommitments();
        const end = new Date(endDate);
        const start = new Date(end);
        start.setDate(start.getDate() - 6); // Last 7 days
        
        let total = 0;
        let met = 0;
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = Utils.getDateString(d);
            const commitment = allCommitments[dateStr];
            
            if (commitment && commitment.wakeup && commitment.wakeup.met !== null) {
                total++;
                if (commitment.wakeup.met) met++;
            }
        }
        
        return total > 0 ? Utils.calculatePercentage(met, total) : 0;
    },

    /**
     * Get excuse patterns
     */
    getExcusePatterns(limit = 30) {
        const allCommitments = StorageManager.getAllCommitments();
        const dates = Object.keys(allCommitments).sort().reverse().slice(0, limit);
        const excuses = {};
        
        dates.forEach(date => {
            const commitment = allCommitments[date];
            if (commitment.wakeup && commitment.wakeup.excuse) {
                const excuse = commitment.wakeup.excuse;
                excuses[excuse] = (excuses[excuse] || 0) + 1;
            }
        });
        
        return Object.entries(excuses)
            .sort((a, b) => b[1] - a[1])
            .map(([excuse, count]) => ({ excuse, count }));
    },

    /**
     * Get commitment for today
     */
    getTodayCommitment() {
        return StorageManager.getCommitments(Utils.getTodayString());
    },

    /**
     * Get commitment for yesterday
     */
    getYesterdayCommitment() {
        return StorageManager.getCommitments(Utils.getYesterdayString());
    },

    /**
     * Check if morning check-in is needed
     */
    needsMorningCheckin() {
        const lastCheckin = StorageManager.getLastCheckin();
        const today = Utils.getTodayString();
        return lastCheckin !== today;
    },

    /**
     * Check if evening check-in is needed
     */
    needsEveningCheckin() {
        const lastEveningCheckin = StorageManager.getLastEveningCheckin();
        const today = Utils.getTodayString();
        const hour = new Date().getHours();
        
        // Show evening check-in between 8pm and 2am
        const isEveningTime = hour >= 20 || hour < 2;
        
        return isEveningTime && lastEveningCheckin !== today;
    },

    /**
     * Mark morning check-in complete
     */
    completeMorningCheckin() {
        StorageManager.saveLastCheckin(Utils.getTodayString());
    },

    /**
     * Mark evening check-in complete
     */
    completeEveningCheckin() {
        StorageManager.saveLastEveningCheckin(Utils.getTodayString());
    },

    /**
     * Get statistics
     */
    getStats() {
        const allCommitments = StorageManager.getAllCommitments();
        const dates = Object.keys(allCommitments).sort();
        
        let totalDays = 0;
        let wakeupOnTime = 0;
        let obligationsCompleted = 0;
        let obligationsTotal = 0;
        
        dates.forEach(date => {
            const commitment = allCommitments[date];
            
            if (commitment.wakeup && commitment.wakeup.met !== null) {
                totalDays++;
                if (commitment.wakeup.met) wakeupOnTime++;
            }
            
            if (commitment.obligations && commitment.obligations.length > 0) {
                obligationsTotal += commitment.obligations.length;
                obligationsCompleted += commitment.obligations.filter(o => o.completed).length;
            }
        });
        
        const streak = this.calculateWakeupStreak();
        const weeklyScore = this.calculateWeeklyScore();
        
        return {
            totalDays,
            wakeupOnTime,
            wakeupRate: totalDays > 0 ? Utils.calculatePercentage(wakeupOnTime, totalDays) : 0,
            currentStreak: streak.current,
            longestStreak: streak.longest,
            weeklyScore,
            obligationsTotal,
            obligationsCompleted,
            obligationRate: obligationsTotal > 0 ? Utils.calculatePercentage(obligationsCompleted, obligationsTotal) : 0
        };
    },

    /**
     * Get recent history
     */
    getRecentHistory(days = 7) {
        const allCommitments = StorageManager.getAllCommitments();
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));
        
        const history = [];
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = Utils.getDateString(d);
            const commitment = allCommitments[dateStr] || this.createEmptyCommitment(dateStr);
            history.push(commitment);
        }
        
        return history;
    }
};

// Make CommitmentTracker available globally
window.CommitmentTracker = CommitmentTracker;

// Made with Bob
