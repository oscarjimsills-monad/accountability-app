/**
 * Accountability Messaging System
 * Generates harsh but fair feedback messages
 */

const AccountabilityMessages = {
    /**
     * Get wake-up accountability message
     */
    getWakeupMessage(commitment) {
        const { met, minutesLate, streak, previousStreak, excuse } = commitment.wakeup;
        const weeklyScore = CommitmentTracker.calculateWeeklyScore();
        
        if (met) {
            return this.getSuccessMessage(streak, weeklyScore);
        } else {
            return this.getFailureMessage(minutesLate, streak, previousStreak, weeklyScore, excuse);
        }
    },

    /**
     * Success messages (when commitment is met)
     */
    getSuccessMessage(streak, weeklyScore) {
        const messages = [];
        
        // Main success message
        messages.push({
            type: 'success',
            text: '✅ Commitment kept!',
            emphasis: true
        });
        
        // Streak message
        if (streak === 1) {
            messages.push({
                type: 'success',
                text: "You're back on track. Keep it going."
            });
        } else if (streak < 7) {
            messages.push({
                type: 'success',
                text: `🔥 ${streak}-day streak! You're building discipline.`
            });
        } else if (streak < 30) {
            messages.push({
                type: 'success',
                text: `🔥 ${streak}-day streak! You're crushing it!`
            });
        } else {
            messages.push({
                type: 'success',
                text: `🔥 ${streak}-day streak! This is what consistency looks like.`
            });
        }
        
        // Weekly score message
        if (weeklyScore === 100) {
            messages.push({
                type: 'success',
                text: 'Perfect week! 100% on time.'
            });
        } else if (weeklyScore >= 80) {
            messages.push({
                type: 'success',
                text: `${weeklyScore}% this week. Strong performance.`
            });
        }
        
        // Motivational message
        const motivational = [
            "You said you would, and you did.",
            "This is how you build trust with yourself.",
            "Discipline is choosing what you want most over what you want now.",
            "Small wins compound into big results."
        ];
        messages.push({
            type: 'info',
            text: Utils.randomItem(motivational)
        });
        
        return messages;
    },

    /**
     * Failure messages (when commitment is not met)
     */
    getFailureMessage(minutesLate, streak, previousStreak, weeklyScore, excuse) {
        const messages = [];
        
        // Main failure message
        const hours = Math.floor(minutesLate / 60);
        const mins = minutesLate % 60;
        
        if (hours > 0) {
            messages.push({
                type: 'error',
                text: `❌ You're ${hours} hour${hours > 1 ? 's' : ''} ${mins > 0 ? `${mins} minutes` : ''} late.`,
                emphasis: true
            });
        } else {
            messages.push({
                type: 'error',
                text: `❌ You're ${mins} minutes late.`,
                emphasis: true
            });
        }
        
        // Time lost message
        messages.push({
            type: 'error',
            text: `That's ${Utils.formatMinutes(minutesLate)} of your life you won't get back.`
        });
        
        // Streak broken message
        if (previousStreak > 0) {
            messages.push({
                type: 'error',
                text: `💔 Streak broken. You were at ${previousStreak} days.`
            });
            messages.push({
                type: 'warning',
                text: 'Back to day 1.'
            });
        } else {
            messages.push({
                type: 'warning',
                text: 'No streak to maintain. Start building one.'
            });
        }
        
        // Weekly score message
        if (weeklyScore < 50) {
            messages.push({
                type: 'error',
                text: `${weeklyScore}% success rate this week. That's failing.`
            });
        } else if (weeklyScore < 80) {
            messages.push({
                type: 'warning',
                text: `${weeklyScore}% this week. You can do better.`
            });
        }
        
        // Pattern recognition
        const patterns = CommitmentTracker.getExcusePatterns(7);
        if (patterns.length > 0 && patterns[0].count >= 3) {
            messages.push({
                type: 'warning',
                text: `This is the ${Utils.getOrdinal(patterns[0].count)} time this week.`
            });
            messages.push({
                type: 'warning',
                text: 'This is becoming a pattern.'
            });
        }
        
        // Excuse handling
        if (excuse) {
            messages.push({
                type: 'info',
                text: `Your excuse: "${this.getExcuseText(excuse)}"`
            });
            messages.push({
                type: 'warning',
                text: this.getExcuseResponse(excuse)
            });
        }
        
        // Harsh but constructive
        messages.push({
            type: 'info',
            text: 'Excuses don\'t change the outcome.'
        });
        
        messages.push({
            type: 'info',
            text: 'Do better tomorrow.'
        });
        
        return messages;
    },

    /**
     * Get excuse text
     */
    getExcuseText(excuse) {
        const excuses = {
            stayed_up_late: 'Stayed up too late',
            alarm_didnt_work: 'Alarm didn\'t go off',
            hit_snooze: 'Hit snooze too many times',
            didnt_feel_like_it: 'Just didn\'t feel like it',
            not_enough_sleep: 'Didn\'t get enough sleep',
            forgot_to_set_alarm: 'Forgot to set alarm',
            woke_up_tired: 'Woke up too tired',
            other: 'Other reason'
        };
        return excuses[excuse] || excuse;
    },

    /**
     * Get response to excuse
     */
    getExcuseResponse(excuse) {
        const responses = {
            stayed_up_late: 'Staying up late was YOUR choice. You knew the consequences.',
            alarm_didnt_work: 'The alarm went off. You chose to ignore it.',
            hit_snooze: 'Every snooze was a choice. You chose comfort over commitment.',
            didnt_feel_like_it: 'Discipline is doing it even when you don\'t feel like it.',
            not_enough_sleep: 'Then go to bed earlier. You control your bedtime.',
            forgot_to_set_alarm: 'Forgetting is not an excuse. Set it now for tomorrow.',
            woke_up_tired: 'Everyone wakes up tired. Successful people get up anyway.',
            other: 'Whatever the reason, you still missed your commitment.'
        };
        return responses[excuse] || 'Own it. Do better tomorrow.';
    },

    /**
     * Get obligation accountability message
     */
    getObligationMessage(obligations) {
        const total = obligations.length;
        const completed = obligations.filter(o => o.completed).length;
        const missed = total - completed;
        const rate = Utils.calculatePercentage(completed, total);
        
        const messages = [];
        
        if (missed === 0) {
            messages.push({
                type: 'success',
                text: `✅ All ${total} obligations completed!`
            });
            messages.push({
                type: 'success',
                text: 'You kept your word. Well done.'
            });
        } else {
            messages.push({
                type: 'warning',
                text: `⚠️ Completed ${completed}/${total} obligations (${rate}%)`
            });
            messages.push({
                type: 'error',
                text: `You missed ${missed} commitment${missed > 1 ? 's' : ''}.`
            });
            
            // List missed obligations
            const missedOnes = obligations.filter(o => !o.completed);
            missedOnes.forEach(obligation => {
                messages.push({
                    type: 'error',
                    text: `❌ ${obligation.title}${obligation.reason ? ` - "${obligation.reason}"` : ''}`
                });
            });
            
            messages.push({
                type: 'warning',
                text: 'Commitments mean nothing if you don\'t keep them.'
            });
        }
        
        return messages;
    },

    /**
     * Get bedtime accountability message
     */
    getBedtimeMessage(bedtime, wakeup) {
        const messages = [];
        
        if (!bedtime.actual) return messages;
        
        const { met, minutesLate } = bedtime;
        
        if (met) {
            messages.push({
                type: 'success',
                text: '✅ Bedtime commitment kept.'
            });
        } else {
            messages.push({
                type: 'warning',
                text: `⚠️ Went to bed ${Utils.formatMinutes(minutesLate)} late.`
            });
            
            // Check correlation with wake-up
            if (wakeup && !wakeup.met) {
                messages.push({
                    type: 'error',
                    text: 'Late bedtime → Late wake-up. See the connection?'
                });
            }
        }
        
        return messages;
    },

    /**
     * Get motivational quote based on performance
     */
    getMotivationalQuote(performance) {
        const quotes = {
            excellent: [
                "Excellence is not an act, but a habit. - Aristotle",
                "Success is the sum of small efforts repeated day in and day out.",
                "Discipline is the bridge between goals and accomplishment."
            ],
            good: [
                "Progress, not perfection.",
                "Every day is a new opportunity to improve.",
                "Consistency beats intensity every time."
            ],
            poor: [
                "The only way to do great work is to love what you do. - Steve Jobs",
                "Don't watch the clock; do what it does. Keep going.",
                "You don't have to be great to start, but you have to start to be great."
            ],
            failing: [
                "Rock bottom became the solid foundation on which I rebuilt my life. - J.K. Rowling",
                "It's not about perfect. It's about effort.",
                "Fall seven times, stand up eight. - Japanese Proverb"
            ]
        };
        
        return Utils.randomItem(quotes[performance] || quotes.good);
    },

    /**
     * Get performance level
     */
    getPerformanceLevel(weeklyScore, streak) {
        if (weeklyScore >= 90 && streak >= 7) return 'excellent';
        if (weeklyScore >= 70 && streak >= 3) return 'good';
        if (weeklyScore >= 50) return 'poor';
        return 'failing';
    },

    /**
     * Format messages for display
     */
    formatMessages(messages) {
        return messages.map(msg => {
            const classes = ['accountability-message', `message-${msg.type}`];
            if (msg.emphasis) classes.push('message-emphasis');
            
            return `<div class="${classes.join(' ')}">${Utils.escapeHtml(msg.text)}</div>`;
        }).join('');
    },

    /**
     * Get complete accountability report
     */
    getAccountabilityReport(commitment) {
        const messages = [];
        
        // Wake-up accountability
        if (commitment.wakeup && commitment.wakeup.actual) {
            messages.push(...this.getWakeupMessage(commitment));
        }
        
        // Bedtime accountability
        if (commitment.bedtime && commitment.bedtime.actual) {
            messages.push(...this.getBedtimeMessage(commitment.bedtime, commitment.wakeup));
        }
        
        // Obligations accountability
        if (commitment.obligations && commitment.obligations.length > 0) {
            messages.push(...this.getObligationMessage(commitment.obligations));
        }
        
        // Add motivational quote
        const weeklyScore = CommitmentTracker.calculateWeeklyScore();
        const streak = commitment.wakeup ? commitment.wakeup.streak : 0;
        const performance = this.getPerformanceLevel(weeklyScore, streak);
        
        messages.push({
            type: 'quote',
            text: this.getMotivationalQuote(performance)
        });
        
        return messages;
    }
};

// Make AccountabilityMessages available globally
window.AccountabilityMessages = AccountabilityMessages;

// Made with Bob
