/**
 * Prompt Flow Manager
 * Handles morning and evening check-in flows
 */

const PromptFlow = {
    currentFlow: null,
    currentStep: 0,
    flowData: {},
    
    /**
     * Initialize prompt flow system
     */
    init() {
        this.setupEventListeners();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const nextBtn = document.getElementById('prompt-next-btn');
        const backBtn = document.getElementById('prompt-back-btn');
        const skipBtn = document.getElementById('prompt-skip-btn');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.handleNext());
        }
        if (backBtn) {
            backBtn.addEventListener('click', () => this.handleBack());
        }
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.handleSkip());
        }
    },

    /**
     * Start appropriate check-in flow
     */
    startCheckIn() {
        // Determine which flow to show
        if (CommitmentTracker.needsMorningCheckin()) {
            this.startMorningFlow();
        } else if (CommitmentTracker.needsWeeklyReview()) {
            this.startWeeklyReview();
        } else if (CommitmentTracker.needsEveningCheckin()) {
            this.startEveningFlow();
        } else {
            // Already checked in today
            this.showWelcomeBack();
        }
    },

    /**
     * Start morning accountability flow
     */
    startMorningFlow() {
        this.currentFlow = 'morning';
        this.currentStep = 0;
        this.flowData = {};
        
        this.showPromptContainer();
        this.renderStep();
    },

    startWeeklyReview() {
        this.currentFlow = 'weekly';
        this.currentStep = 0;
        this.flowData = {};
        this.showPromptContainer();
        this.renderStep();
    },

    /**
     * Start evening commitment flow
     */
    startEveningFlow() {
        this.currentFlow = 'evening';
        this.currentStep = 0;
        this.flowData = {};
        
        this.showPromptContainer();
        this.renderStep();
    },

    /**
     * Show welcome back message (already checked in)
     */
    showWelcomeBack() {
        const userName = StorageManager.getUserName();
        const greeting = Utils.getGreeting();
        const stats = CommitmentTracker.getStats();
        
        const content = document.getElementById('prompt-content');
        content.innerHTML = `
            <div class="prompt-screen welcome-back">
                <h2>${greeting}, ${userName}! 👋</h2>
                <p class="subtitle">You're all caught up for today.</p>
                
                <div class="stats-quick">
                    <div class="stat-item">
                        <span class="stat-value">🔥 ${stats.currentStreak}</span>
                        <span class="stat-label">Day Streak</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${stats.weeklyScore}%</span>
                        <span class="stat-label">This Week</span>
                    </div>
                </div>
                
                <button class="btn btn-primary btn-large" onclick="PromptFlow.goToDashboard()">
                    Go to Dashboard →
                </button>
            </div>
        `;
        
        this.showPromptContainer();
        document.getElementById('prompt-progress-fill').style.width = '100%';
        document.getElementById('prompt-step-indicator').textContent = 'All set!';
        document.getElementById('prompt-next-btn').style.display = 'none';
        document.getElementById('prompt-back-btn').style.display = 'none';
        document.getElementById('prompt-skip-btn').style.display = 'none';
    },

    /**
     * Render current step
     */
    renderStep() {
        const steps = this.currentFlow === 'morning'
            ? this.getMorningSteps() 
            : this.currentFlow === 'weekly'
                ? this.getWeeklySteps()
                : this.getEveningSteps();
        const step = steps[this.currentStep];
        
        if (!step) {
            this.completeFlow();
            return;
        }
        
        // Update progress
        const progress = ((this.currentStep + 1) / steps.length) * 100;
        document.getElementById('prompt-progress-fill').style.width = `${progress}%`;
        document.getElementById('prompt-step-indicator').textContent = `Step ${this.currentStep + 1} of ${steps.length}`;
        
        // Render step content
        const content = document.getElementById('prompt-content');
        content.innerHTML = step.render(this.flowData);
        
        // Update navigation buttons
        document.getElementById('prompt-back-btn').style.display = this.currentStep > 0 ? 'block' : 'none';
        document.getElementById('prompt-skip-btn').style.display = step.skippable ? 'block' : 'none';
        document.getElementById('prompt-next-btn').textContent = this.currentStep === steps.length - 1 ? 'Complete' : 'Continue →';
        
        // Setup step-specific event listeners
        if (step.setupListeners) {
            step.setupListeners(this.flowData);
        }
    },

    /**
     * Get morning flow steps
     */
    getMorningSteps() {
        const lastEveningCheckin = StorageManager.getLastEveningCheckin();
        const yesterday = Utils.getYesterdayString();
        const didEveningCheckin = lastEveningCheckin === Utils.getLogDateString();
        const allSteps = [
            {
                name: 'wake-up-check',
                skippable: false,
                render: (data) => {
                    const hour = new Date().getHours();
                    const commitmentDate = Utils.getLogDateString();
                    const today = StorageManager.getCommitments(commitmentDate);
                    const commitment = (today && today.wakeup && today.wakeup.commitment) ? today.wakeup.commitment : '07:00';
                    const currentTime = new Date();
                    const currentTimeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
                    
                    return `
                        <div class="prompt-screen accountability-check">
                            <h2>⏰ Wake-up Accountability</h2>
                            <p class="subtitle">Time to face the truth.</p>
                            
                            <div class="commitment-box">
                                <div class="commitment-label">You committed to wake up at:</div>
                                <div class="commitment-value">${Utils.formatTimeString(commitment)}</div>
                            </div>
                            
                            <div class="form-group">
                                <label for="actual-wakeup">What time did you actually wake up?</label>
                                <input type="time" id="actual-wakeup" class="input-time" value="${currentTimeStr}" required>
                            </div>
                            
                            <div id="excuse-section" style="display: none;">
                                <div class="form-group">
                                    <label for="wakeup-excuse">Why were you late?</label>
                                    <select id="wakeup-excuse" class="input-select">
                                        <option value="">Select a reason...</option>
                                        <option value="stayed_up_late">Stayed up too late</option>
                                        <option value="alarm_didnt_work">Alarm didn't go off</option>
                                        <option value="hit_snooze">Hit snooze too many times</option>
                                        <option value="didnt_feel_like_it">Just didn't feel like it</option>
                                        <option value="not_enough_sleep">Didn't get enough sleep</option>
                                        <option value="forgot_to_set_alarm">Forgot to set alarm</option>
                                        <option value="woke_up_tired">Woke up too tired</option>
                                        <option value="other">Other reason</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    `;
                },
                setupListeners: (data) => {
                    const hour = new Date().getHours();
                    const commitmentDate = Utils.getLogDateString();
                    const today = StorageManager.getCommitments(commitmentDate);
                    const commitment = (today && today.wakeup && today.wakeup.commitment) ? today.wakeup.commitment : '07:00';
                    const actualInput = document.getElementById('actual-wakeup');
                    const excuseSection = document.getElementById('excuse-section');
                    const gracePeriod = StorageManager.getSettings().gracePeriodMinutes || 15;
                    
                    actualInput.addEventListener('change', () => {
                        const actual = actualInput.value;
                        const minutesLate = Utils.timeDifferenceMinutes(commitment, actual);
                        
                        if (minutesLate > gracePeriod) {
                            excuseSection.style.display = 'block';
                        } else {
                            excuseSection.style.display = 'none';
                        }
                    });
                    
                    // Trigger initial check
                    actualInput.dispatchEvent(new Event('change'));
                },
                validate: (data) => {
                    const actual = document.getElementById('actual-wakeup').value;
                    if (!actual) {
                        Utils.showError('Please enter your actual wake-up time');
                        return false;
                    }
                    
                    const hour = new Date().getHours();
                    const commitmentDate = Utils.getLogDateString();
                    const today = StorageManager.getCommitments(commitmentDate);
                    const commitment = (today && today.wakeup && today.wakeup.commitment) ? today.wakeup.commitment : '07:00';
                    const minutesLate = Utils.timeDifferenceMinutes(commitment, actual);
                    const gracePeriod = StorageManager.getSettings().gracePeriodMinutes || 15;
                    
                    if (minutesLate > gracePeriod) {
                        const excuse = document.getElementById('wakeup-excuse').value;
                        if (!excuse) {
                            Utils.showError('Please select a reason for being late');
                            return false;
                        }
                        data.wakeupExcuse = excuse;
                    }
                    
                    data.actualWakeup = actual;
                    return true;
                }
            },
            {
                name: 'bedtime-check',
                skippable: false,
                render: (data) => {
                    const yesterday = Utils.getYesterdayString();
                    const yesterdayCommitment = StorageManager.getCommitments(yesterday);
                    const commitment = (yesterdayCommitment && yesterdayCommitment.bedtime && yesterdayCommitment.bedtime.commitment) ? yesterdayCommitment.bedtime.commitment : '23:00';
                    
                    return `
                        <div class="prompt-screen">
                            <h2>🛏️ Bedtime Check</h2>
                            <p class="subtitle">What time did you actually go to bed last night?</p>
                            
                            <div class="commitment-box">
                                <div class="commitment-label">You committed to bed by:</div>
                                <div class="commitment-value">${Utils.formatTimeString(commitment)}</div>
                            </div>
                            
                            <div class="form-group">
                                <label for="actual-bedtime">Actual bedtime</label>
                                <input type="time" id="actual-bedtime" class="input-time" required>
                                <p class="help-text">When did you actually get into bed?</p>
                            </div>
                        </div>
                    `;
                },
                validate: (data) => {
                    const actual = document.getElementById('actual-bedtime').value;
                    if (!actual) {
                        Utils.showError('Please enter your actual bedtime');
                        return false;
                    }
                    
                    data.actualBedtime = actual;
                    return true;
                }
            },
            {
                name: 'accountability-message',
                skippable: false,
                render: (data) => {
                    const today = Utils.getLogDateString();
                    CommitmentTracker.checkCommitment('wakeup', data.actualWakeup, today, data.wakeupExcuse);
                    
                    const commitment = StorageManager.getCommitments(today);
                    const messages = AccountabilityMessages.getWakeupMessage(commitment);
                    
                    return `
                        <div class="prompt-screen accountability-result">
                            <h2>📊 Accountability Report</h2>
                            <div class="accountability-messages">
                                ${AccountabilityMessages.formatMessages(messages)}
                            </div>
                        </div>
                    `;
                }
            },
            {
                name: 'mood-check',
                skippable: true,
                render: (data) => {
                    return `
                        <div class="prompt-screen mood-check">
                            <h2>😊 How are you feeling?</h2>
                            <p class="subtitle">Quick mood check for today.</p>
                            
                            <div class="mood-options">
                                <button class="mood-btn" data-mood="great">
                                    <span class="mood-emoji">😄</span>
                                    <span class="mood-label">Great</span>
                                </button>
                                <button class="mood-btn" data-mood="good">
                                    <span class="mood-emoji">🙂</span>
                                    <span class="mood-label">Good</span>
                                </button>
                                <button class="mood-btn" data-mood="okay">
                                    <span class="mood-emoji">😐</span>
                                    <span class="mood-label">Okay</span>
                                </button>
                                <button class="mood-btn" data-mood="bad">
                                    <span class="mood-emoji">😟</span>
                                    <span class="mood-label">Bad</span>
                                </button>
                                <button class="mood-btn" data-mood="terrible">
                                    <span class="mood-emoji">😢</span>
                                    <span class="mood-label">Terrible</span>
                                </button>
                            </div>
                        </div>
                    `;
                },
                setupListeners: (data) => {
                    document.querySelectorAll('.mood-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
                            btn.classList.add('selected');
                            data.mood = btn.dataset.mood;
                        });
                    });
                }
            },
            {
                name: 'ready',
                skippable: false,
                render: (data) => {
                    const stats = CommitmentTracker.getStats();
                    
                    return `
                        <div class="prompt-screen ready-screen">
                            <h2>✅ You're all set!</h2>
                            <p class="subtitle">Morning check-in complete.</p>
                            
                            <div class="stats-summary">
                                <div class="stat-card">
                                    <span class="stat-icon">🔥</span>
                                    <span class="stat-number">${stats.currentStreak}</span>
                                    <span class="stat-text">Day Streak</span>
                                </div>
                                <div class="stat-card">
                                    <span class="stat-icon">📈</span>
                                    <span class="stat-number">${stats.weeklyScore}%</span>
                                    <span class="stat-text">This Week</span>
                                </div>
                            </div>
                            
                            <p class="motivational-text">Let's make today count!</p>
                        </div>
                    `;
                }
            }
        ];
        return didEveningCheckin ? allSteps.filter(s => s.name !== 'bedtime-check') : allSteps;
    },

    getWeeklySteps() {
        return [
            {
                name: 'weekly-stats',
                skippable: false,
                render: (data) => {
                    const weekKey = CommitmentTracker.getWeekKey();
                    const allCommitments = StorageManager.getAllCommitments();
                    const wakeupStreak = CommitmentTracker.calculateWakeupStreak();
                    const weeklyScore = CommitmentTracker.calculateWeeklyScore();

                    // Count obligations completed this week
                    let obTotal = 0, obCompleted = 0;
                    for (let i = 0; i < 7; i++) {
                        const d = new Date(weekKey);
                        d.setDate(d.getDate() + i);
                        const c = allCommitments[Utils.getDateString(d)];
                        if (c?.obligations) {
                            obTotal += c.obligations.length;
                            obCompleted += c.obligations.filter(o => o.completed).length;
                        }
                    }

                    // Total time tracked this week
                    const weekStart = weekKey;
                    const weekEnd = Utils.getDateString(new Date(new Date(weekKey).setDate(new Date(weekKey).getDate() + 6)));
                    const weekEntries = TimeTracker.getEntriesByDateRange(weekStart, weekEnd);
                    const totalTracked = weekEntries.reduce((sum, e) => sum + e.duration, 0);
                    const avgFocus = weekEntries.filter(e => e.focusRating).length > 0
                        ? (weekEntries.filter(e => e.focusRating).reduce((sum, e) => sum + e.focusRating, 0) / weekEntries.filter(e => e.focusRating).length).toFixed(1)
                        : null;

                    return `
                        <div class="prompt-screen weekly-stats">
                            <h2>📅 Weekly Review</h2>
                            <p class="subtitle">Here's how your week looked.</p>

                            <div class="weekly-stats-grid">
                                <div class="weekly-stat">
                                    <div class="weekly-stat-value">${weeklyScore}%</div>
                                    <div class="weekly-stat-label">Wake-up Rate</div>
                                </div>
                                <div class="weekly-stat">
                                    <div class="weekly-stat-value">${wakeupStreak.current}</div>
                                    <div class="weekly-stat-label">Current Streak</div>
                                </div>
                                <div class="weekly-stat">
                                    <div class="weekly-stat-value">${obTotal > 0 ? Math.round((obCompleted/obTotal)*100) : 0}%</div>
                                    <div class="weekly-stat-label">Obligations Met</div>
                                </div>
                                <div class="weekly-stat">
                                    <div class="weekly-stat-value">${Math.floor(totalTracked / 60)}h</div>
                                    <div class="weekly-stat-label">Time Tracked</div>
                                </div>
                                ${avgFocus ? `
                                    <div class="weekly-stat">
                                        <div class="weekly-stat-value">${avgFocus}⭐</div>
                                        <div class="weekly-stat-label">Avg Focus</div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }
            },
            {
                name: 'weekly-reflection',
                skippable: true,
                render: (data) => {
                    return `
                        <div class="prompt-screen weekly-reflection">
                            <h2>💭 Weekly Reflection</h2>
                            <p class="subtitle">What went well? What didn't?</p>

                            <div class="form-group">
                                <label for="weekly-wins">What went well this week?</label>
                                <textarea id="weekly-wins" class="input-textarea" rows="3" 
                                    placeholder="Your wins, however small..."></textarea>
                            </div>

                            <div class="form-group">
                                <label for="weekly-struggles">What did you struggle with?</label>
                                <textarea id="weekly-struggles" class="input-textarea" rows="3"
                                    placeholder="Be honest..."></textarea>
                            </div>
                        </div>
                    `;
                },
                validate: (data) => {
                    data.weeklyWins = document.getElementById('weekly-wins').value.trim();
                    data.weeklyStruggles = document.getElementById('weekly-struggles').value.trim();
                    return true;
                }
            },
            {
                name: 'weekly-goals',
                skippable: false,
                render: (data) => {
                    return `
                        <div class="prompt-screen weekly-goals">
                            <h2>🎯 Next Week's Goals</h2>
                            <p class="subtitle">Set 3 meaningful goals for the coming week.</p>

                            <div class="form-group">
                                <label for="weekly-goal-1">Goal #1</label>
                                <input type="text" id="weekly-goal-1" class="input-text" 
                                    placeholder="Most important goal for next week">
                            </div>
                            <div class="form-group">
                                <label for="weekly-goal-2">Goal #2</label>
                                <input type="text" id="weekly-goal-2" class="input-text"
                                    placeholder="Second goal">
                            </div>
                            <div class="form-group">
                                <label for="weekly-goal-3">Goal #3</label>
                                <input type="text" id="weekly-goal-3" class="input-text"
                                    placeholder="Third goal">
                            </div>
                        </div>
                    `;
                },
                validate: (data) => {
                    const goals = [];
                    for (let i = 1; i <= 3; i++) {
                        const val = document.getElementById(`weekly-goal-${i}`).value.trim();
                        if (val) goals.push({ title: val, completed: false });
                    }
                    if (goals.length === 0) {
                        Utils.showError('Set at least one goal for next week');
                        return false;
                    }
                    data.weeklyGoals = goals;
                    return true;
                }
            },
            {
                name: 'weekly-summary',
                skippable: false,
                render: (data) => {
                    return `
                        <div class="prompt-screen weekly-summary">
                            <h2>✅ Week Locked In</h2>
                            <p class="subtitle">Your goals for next week:</p>

                            <div class="goals-list">
                                ${(data.weeklyGoals || []).map((g, i) => `
                                    <div class="weekly-goal-item">
                                        <span class="goal-number">${i + 1}</span>
                                        <span class="goal-title">${Utils.escapeHtml(g.title)}</span>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="commitment-warning">
                                <p>⚠️ <strong>These are your commitments for the week.</strong> You'll review progress next Sunday.</p>
                            </div>
                        </div>
                    `;
                }
            }
        ];
    },

    /**
     * Get evening flow steps
     */
    getEveningSteps() {
        return [
            {
                name: 'obligations-review',
                skippable: true,
                render: (data) => {
                    const logDate = Utils.getLogDateString();
                    const commitment = StorageManager.getCommitments(logDate);
                    const obligations = commitment?.obligations || [];

                    if (obligations.length === 0) return `
                        <div class="prompt-screen obligations-review">
                            <h2>📋 Today's Obligations</h2>
                            <p class="subtitle">No obligations were set for today.</p>
                        </div>
                    `;

                    const completed = obligations.filter(o => o.completed).length;

                    return `
                        <div class="prompt-screen obligations-review">
                            <h2>📋 Today's Obligations</h2>
                            <p class="subtitle">How did you do? ${completed}/${obligations.length} completed.</p>
                            <div class="obligations-list">
                                ${obligations.map((o, i) => `
                                    <div class="obligation-card ${o.completed ? 'completed' : ''}">
                                        <div class="obligation-checkbox">
                                            <input type="checkbox" id="ev-obligation-${i}" 
                                                ${o.completed ? 'checked' : ''}
                                                onchange="PromptFlow.toggleEveningObligation(${i})">
                                            <label for="ev-obligation-${i}"></label>
                                        </div>
                                        <div class="obligation-content">
                                            <h3 class="obligation-title">${Utils.escapeHtml(o.title)}</h3>
                                        </div>
                                        ${o.completed ? '<div class="completion-badge">✓</div>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            },

            {
                name: 'priorities-rating',
                skippable: true,
                render: (data) => {
                    const logDate = Utils.getLogDateString();
                    const commitment = StorageManager.getCommitments(logDate);
                    const priorities = commitment?.priorities || [];

                    if (priorities.length === 0) return `
                        <div class="prompt-screen priorities-rating">
                            <h2>🎯 Today's Priorities</h2>
                            <p class="subtitle">No priorities were set for today.</p>
                        </div>
                    `;

                    return `
                        <div class="prompt-screen priorities-rating">
                            <h2>🎯 How Well Did You Achieve Your Priorities?</h2>
                            <p class="subtitle">Rate each priority: 1 = Not at all, 2 = Somewhat, 3 = Achieved well</p>
                            
                            <div class="priorities-rating-list">
                                ${priorities.map((p, i) => `
                                    <div class="priority-rating-card">
                                        <div class="priority-info">
                                            <h3 class="priority-title">${Utils.escapeHtml(p.title)}</h3>
                                            <span class="priority-level ${p.priority}">${p.priority}</span>
                                        </div>
                                        <div class="rating-buttons">
                                            ${[1, 2, 3].map(rating => `
                                                <button class="rating-btn ${data.priorityRatings?.[i] === rating ? 'selected' : ''}"
                                                    data-priority="${i}"
                                                    data-rating="${rating}"
                                                    onclick="PromptFlow.ratePriority(${i}, ${rating})">
                                                    ${rating}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                },
                validate: (data) => {
                    const logDate = Utils.getLogDateString();
                    const commitment = StorageManager.getCommitments(logDate);
                    const priorities = commitment?.priorities || [];
                    
                    if (priorities.length === 0) return true;
                    
                    // Check if all priorities have been rated
                    if (!data.priorityRatings) data.priorityRatings = {};
                    
                    const allRated = priorities.every((p, i) => data.priorityRatings[i] !== undefined);
                    
                    if (!allRated) {
                        Utils.showError('Please rate all priorities');
                        return false;
                    }
                    
                    // Save ratings to commitment
                    priorities.forEach((p, i) => {
                        p.rating = data.priorityRatings[i];
                    });
                    StorageManager.saveCommitments(logDate, commitment);
                    
                    return true;
                }
            },

            {
        name: 'day-walkthrough',
                skippable: true,
                render: (data) => {
                    // Initialise walk-through state on first render
                    if (!data.walkthrough) {
                        const logDate = Utils.getLogDateString();
                        const commitment = StorageManager.getCommitments(logDate);
                        const wakeupTime = commitment?.wakeup?.actual || commitment?.wakeup?.commitment || '08:00';
                        const [wh, wm] = wakeupTime.split(':').map(Number);
                        
                        // Load existing time entries for this log day
                        // Need to include entries from the next calendar day if they're before 5am
                        const nextDay = new Date(logDate);
                        nextDay.setDate(nextDay.getDate() + 1);
                        const nextDayStr = Utils.getDateString(nextDay);
                        
                        const existingEntries = TimeTracker.timeEntries.filter(entry => {
                            // Include entries from the log date
                            if (entry.date === logDate) {
                                // But exclude entries before 5am (they belong to previous log day)
                                const entryTime = new Date(entry.startTime);
                                const entryHour = entryTime.getHours();
                                return entryHour >= 5;
                            }
                            
                            // Also include entries from next calendar day if before 5am
                            if (entry.date === nextDayStr) {
                                const entryTime = new Date(entry.startTime);
                                const entryHour = entryTime.getHours();
                                return entryHour < 5;
                            }
                            
                            return false;
                        }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
                        
                        // Convert existing entries to sessions
                        const sessions = existingEntries.map(entry => {
                            const startTime = new Date(entry.startTime);
                            const hour = startTime.getHours();
                            const minute = startTime.getMinutes();
                            
                            // If the entry is after midnight but before 5am, add 1440 to represent next day
                            let startMinutes = hour * 60 + minute;
                            if (hour < 5) {
                                startMinutes += 1440;
                            }
                            
                            return {
                                activity: entry.activity,
                                duration: entry.duration,
                                focusRating: null,
                                startMinutes: startMinutes,
                                fromTimeTracker: true
                            };
                        });
                        
                        // Find the starting point (either wakeup or first logged activity)
                        let startMinutes = wh * 60 + wm;
                        if (sessions.length > 0 && sessions[0].startMinutes < startMinutes) {
                            startMinutes = sessions[0].startMinutes;
                        }
                        
                        // Calculate current position (end of last session or wakeup time)
                        let currentMinutes = startMinutes;
                        if (sessions.length > 0) {
                            const lastSession = sessions[sessions.length - 1];
                            currentMinutes = lastSession.startMinutes + lastSession.duration;
                        }
                        
                        data.walkthrough = {
                            currentMinutes: currentMinutes,
                            sessions: sessions,
                            phase: 'activity', // 'activity' | 'duration' | 'focus' | 'skip-duration'
                            logDate: logDate
                        };
                    }

                    const wt = data.walkthrough;
                    const now = new Date();
                    const currentHour = now.getHours();
                    
                    // Always end at current time
                    // If before 5am, add 1440 to represent time past midnight
                    let endOfDayMinutes;
                    if (currentHour < 5) {
                        // Past midnight (00:00-04:59), so add 1440 to current time
                        // e.g., 01:16 = 76 minutes, becomes 1440 + 76 = 1516 minutes
                        endOfDayMinutes = 1440 + (currentHour * 60 + now.getMinutes());
                    } else {
                        // Same day (05:00-23:59), use current time
                        endOfDayMinutes = currentHour * 60 + now.getMinutes();
                    }
                    
                    // Calculate remaining time
                    const remainingMinutes = Math.max(0, endOfDayMinutes - wt.currentMinutes);
                    
                    const accountedMinutes = wt.sessions.reduce((sum, s) => sum + s.duration, 0);
                    const totalDayMinutes = remainingMinutes + accountedMinutes;
                    const progressPct = totalDayMinutes > 0 ? Math.min(100, Math.round((accountedMinutes / totalDayMinutes) * 100)) : 0;

                    const currentTimeStr = `${String(Math.floor(wt.currentMinutes / 60) % 24).padStart(2, '0')}:${String(wt.currentMinutes % 60).padStart(2, '0')}`;
                    const formattedTime = Utils.formatTimeString(currentTimeStr);

                    // Day is complete when there's less than 1 minute remaining
                    const isComplete = remainingMinutes < 1;

                    if (isComplete) {
                        return `
                            <div class="prompt-screen day-walkthrough">
                                <h2>✅ Day Accounted For</h2>
                                <p class="subtitle">You've walked through your entire day.</p>
                                <div class="walkthrough-progress">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: 100%"></div>
                                    </div>
                                    <p>${Utils.formatMinutes(accountedMinutes)} logged across ${wt.sessions.length} session${wt.sessions.length !== 1 ? 's' : ''}.</p>
                                </div>
                                <div class="sessions-summary">
                                    ${wt.sessions.map(s => `
                                        <div class="session-item">
                                            <span class="session-activity">${Utils.escapeHtml(s.activity)}</span>
                                            <span class="session-duration">${Utils.formatMinutes(s.duration)}</span>
                                            ${s.focusRating ? `<span class="session-focus">${'⭐'.repeat(s.focusRating)}</span>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }

                    if (wt.phase === 'activity') {
                        const trackedCount = wt.sessions.filter(s => s.fromTimeTracker).length;
                        const manualCount = wt.sessions.length - trackedCount;
                        
                        return `
                            <div class="prompt-screen day-walkthrough">
                                <h2>🗓️ Walk Through Your Day</h2>
                                <p class="subtitle">Starting from <strong>${formattedTime}</strong> — what were you doing?</p>
                                
                                <div class="walkthrough-progress">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${progressPct}%"></div>
                                    </div>
                                    <p class="progress-text">${Utils.formatMinutes(accountedMinutes)} of ~${Utils.formatMinutes(totalDayMinutes)} accounted for</p>
                                    ${trackedCount > 0 ? `<p class="info-text">✓ ${trackedCount} activities already logged from time tracker</p>` : ''}
                                </div>

                                ${wt.sessions.length > 0 ? `
                                    <div class="previous-session">
                                        <p>Previous: <strong>${Utils.escapeHtml(wt.sessions[wt.sessions.length - 1].activity)}</strong> (${Utils.formatMinutes(wt.sessions[wt.sessions.length - 1].duration)})</p>
                                    </div>
                                ` : ''}

                                <div class="form-group">
                                    <label for="wt-activity">Activity</label>
                                    <input type="text" id="wt-activity" class="input-text" placeholder="e.g. Slept, Worked on example sheet, Lunch..." autofocus>
                                </div>

                                <button class="btn btn-text" onclick="PromptFlow.walkthroughSkip()">
                                    Can't remember this period
                                </button>
                            </div>
                        `;
                    }

                    if (wt.phase === 'duration') {
                        const remainingMinutes = Math.max(0, endOfDayMinutes - wt.currentMinutes);
                        const remainingHours = Math.floor(remainingMinutes / 60);
                        const remainingMins = remainingMinutes % 60;
                        
                        return `
                            <div class="prompt-screen day-walkthrough">
                                <h2>⏱️ How long?</h2>
                                <p class="subtitle"><strong>${Utils.escapeHtml(wt.pendingActivity)}</strong> — starting at ${formattedTime}</p>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="wt-hours">Hours</label>
                                        <input type="number" id="wt-hours" class="input-number" min="0" max="24" value="0">
                                    </div>
                                    <div class="form-group">
                                        <label for="wt-minutes">Minutes</label>
                                        <input type="number" id="wt-minutes" class="input-number" min="0" max="59" value="30">
                                    </div>
                                </div>

                                <p class="help-text">Remaining to account for: ~${Utils.formatMinutes(remainingMinutes)}</p>
                                
                                <button class="btn btn-secondary" onclick="PromptFlow.walkthroughUntilNow()">
                                    Until now (${remainingHours}h ${remainingMins}m)
                                </button>
                            </div>
                        `;
                    }

                    if (wt.phase === 'focus') {
                        const endMinutes = wt.currentMinutes;
                        const endTimeStr = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
                        return `
                            <div class="prompt-screen day-walkthrough">
                                <h2>🎯 Focus Rating</h2>
                                <p class="subtitle">How focused were you during <strong>${Utils.escapeHtml(wt.pendingActivity)}</strong>?</p>
                                <p class="time-range">${formattedTime} → ${Utils.formatTimeString(endTimeStr)}</p>

                                <div class="focus-options">
                                    ${[1,2,3,4,5].map(n => `
                                        <button class="focus-btn" data-rating="${n}" onclick="PromptFlow.walkthroughSetFocus(${n})">
                                            ${'⭐'.repeat(n)}
                                            <span class="focus-label">${['Distracted','Low','Moderate','Good','Deep'][n-1]}</span>
                                        </button>
                                    `).join('')}
                                </div>

                                <button class="btn btn-text" onclick="PromptFlow.walkthroughSetFocus(null)">
                                    Skip rating
                                </button>
                            </div>
                        `;
                    }

                    if (wt.phase === 'skip-duration') {
                        return `
                            <div class="prompt-screen day-walkthrough">
                                <h2>⏭️ Skip Period</h2>
                                <p class="subtitle">Roughly how long was this period you can't remember?</p>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="wt-skip-hours">Hours</label>
                                        <input type="number" id="wt-skip-hours" class="input-number" min="0" max="24" value="0">
                                    </div>
                                    <div class="form-group">
                                        <label for="wt-skip-minutes">Minutes</label>
                                        <input type="number" id="wt-skip-minutes" class="input-number" min="0" max="59" value="30">
                                    </div>
                                </div>

                                <p class="help-text">Remaining to account for: ~${Utils.formatMinutes(Math.max(0, endOfDayMinutes - wt.currentMinutes))}</p>
                            </div>
                        `;
                    }
                },
                validate: (data) => {
                    const wt = data.walkthrough;
                    if (!wt) return true;

                    const now = new Date();
                    const currentHour = now.getHours();
                    
                    // Calculate end of day minutes (same logic as render)
                    let endOfDayMinutes;
                    if (currentHour < 5) {
                        endOfDayMinutes = 1440 + (currentHour * 60 + now.getMinutes());
                    } else {
                        endOfDayMinutes = currentHour * 60 + now.getMinutes();
                    }

                    if (wt.phase === 'activity') {
                        const activity = document.getElementById('wt-activity')?.value.trim();
                        if (!activity) {
                            Utils.showError('Enter an activity or use "Can\'t remember"');
                            return false;
                        }
                        wt.pendingActivity = activity;
                        wt.pendingStartMinutes = wt.currentMinutes;
                        wt.phase = 'duration';
                        this.renderStep();
                        return false; // stay on step, re-render
                    }

                    if (wt.phase === 'duration') {
                        const hours = parseInt(document.getElementById('wt-hours')?.value) || 0;
                        const minutes = parseInt(document.getElementById('wt-minutes')?.value) || 0;
                        const duration = hours * 60 + minutes;
                        if (duration <= 0) {
                            Utils.showError('Enter a duration greater than 0');
                            return false;
                        }
                        wt.pendingDuration = duration;
                        wt.phase = 'focus';
                        this.renderStep();
                        return false;
                    }

                    if (wt.phase === 'skip-duration') {
                        const hours = parseInt(document.getElementById('wt-skip-hours')?.value) || 0;
                        const minutes = parseInt(document.getElementById('wt-skip-minutes')?.value) || 0;
                        const duration = hours * 60 + minutes;
                        if (duration <= 0) {
                            Utils.showError('Enter a duration greater than 0');
                            return false;
                        }
                        wt.currentMinutes += duration;
                        wt.phase = 'activity';
                        this.renderStep();
                        return false;
                    }

                    // If complete, allow moving to next step
                    if (endOfDayMinutes - wt.currentMinutes <= 0) return true;

                    // Otherwise keep going
                    return true;
                }
            },

            {
                name: 'day-review',
                skippable: true,
                render: (data) => {
                    return `
                        <div class="prompt-screen day-review">
                            <h2>🌙 Evening Check-in</h2>
                            <p class="subtitle">Let's set up tomorrow for success.</p>
                            
                            <div class="form-group">
                                <label>How was your day?</label>
                                <div class="mood-options">
                                    <button class="mood-btn" data-mood="great">😄</button>
                                    <button class="mood-btn" data-mood="good">🙂</button>
                                    <button class="mood-btn" data-mood="okay">😐</button>
                                    <button class="mood-btn" data-mood="bad">😟</button>
                                    <button class="mood-btn" data-mood="terrible">😢</button>
                                </div>
                            </div>
                        </div>
                    `;
                },
                setupListeners: (data) => {
                    document.querySelectorAll('.mood-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
                            btn.classList.add('selected');
                            data.dayMood = btn.dataset.mood;
                        });
                    });
                }
            },
            {
                name: 'wakeup-commitment',
                skippable: false,
                render: (data) => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = Utils.getDateString(tomorrow);
                    
                    return `
                        <div class="prompt-screen commitment-screen">
                            <h2>⏰ Wake-up Commitment</h2>
                            <p class="subtitle">What time will you wake up tomorrow?</p>
                            <p class="warning-text">⚠️ This is a binding commitment. You'll be held accountable.</p>
                            
                            <div class="form-group">
                                <label for="wakeup-time">Wake-up time</label>
                                <input type="time" id="wakeup-time" class="input-time input-large" value="07:00" required>
                            </div>
                            
                            <div class="commitment-reminder">
                                <p>💡 <strong>Tip:</strong> Be realistic. A 15-minute grace period is allowed.</p>
                            </div>
                        </div>
                    `;
                },
                validate: (data) => {
                    const wakeupTime = document.getElementById('wakeup-time').value;
                    if (!wakeupTime) {
                        Utils.showError('Please set your wake-up time');
                        return false;
                    }
                    data.wakeupCommitment = wakeupTime;
                    return true;
                }
            },
            {
                name: 'obligations',
                skippable: true,
                render: (data) => {
                    return `
                        <div class="prompt-screen obligations-screen">
                            <h2>📋 Tomorrow's Obligations</h2>
                            <p class="subtitle">Non-negotiable commitments with specific times.</p>
                            
                            <div id="obligations-list" class="obligations-list">
                                <!-- Obligations will be added here -->
                            </div>
                            
                            <button type="button" class="btn btn-secondary" onclick="PromptFlow.addObligation()">
                                + Add Obligation
                            </button>
                        </div>
                    `;
                },
                setupListeners: (data) => {
                    // Carry forward any incomplete obligations from today
                    const lastEveningDate = StorageManager.getLastEveningCheckin();
                    if (lastEveningDate && (!data.obligations || data.obligations.length === 0)) {
                        const previousCommitment = StorageManager.getCommitments(lastEveningDate);
                        const missed = (previousCommitment?.obligations || []).filter(o => !o.completed);
                        data.obligations = missed.map(o => ({
                            title: o.title,
                            completed: false,
                            carriedOver: true
                        }));
                    } else {
                        data.obligations = data.obligations || [];
                    }
                    this.renderObligations();
                }
            },
            {
                name: 'priorities',
                skippable: true,
                render: (data) => {
                    return `
                        <div class="prompt-screen priorities-screen">
                            <h2>🎯 Top 3 Priorities</h2>
                            <p class="subtitle">What are the most important tasks for tomorrow?</p>
                            
                            <div class="form-group">
                                <label for="priority-1">Priority #1</label>
                                <input type="text" id="priority-1" class="input-text" placeholder="Most important task">
                            </div>
                            
                            <div class="form-group">
                                <label for="priority-2">Priority #2</label>
                                <input type="text" id="priority-2" class="input-text" placeholder="Second most important">
                            </div>
                            
                            <div class="form-group">
                                <label for="priority-3">Priority #3</label>
                                <input type="text" id="priority-3" class="input-text" placeholder="Third most important">
                            </div>
                        </div>
                    `;
                },
                validate: (data) => {
                    const priorities = [];
                    for (let i = 1; i <= 3; i++) {
                        const value = document.getElementById(`priority-${i}`).value.trim();
                        if (value) {
                            priorities.push({
                                title: value,
                                priority: i === 1 ? 'high' : i === 2 ? 'medium' : 'low',
                                completed: false
                            });
                        }
                    }
                    data.priorities = priorities;
                    return true;
                }
            },
            {
                name: 'screentime-log',
                skippable: true,
                render: (data) => {
                    // Initialize apps array if not exists
                    if (!data.screentimeApps) {
                        data.screentimeApps = [];
                    }
                    
                    const totalMinutes = data.screentimeApps.reduce((sum, app) => sum + app.minutes, 0);
                    const totalHours = Math.floor(totalMinutes / 60);
                    const remainingMinutes = totalMinutes % 60;
                    const dailyGoal = 90;
                    const isOverGoal = totalMinutes > dailyGoal;
                    
                    return `
                        <div class="prompt-screen">
                            <h2>📱 Today's Social Media & Games</h2>
                            <p class="subtitle">Log each app separately from your Apple Screen Time</p>
                            
                            <div class="commitment-reminder">
                                <p>💡 <strong>Tip:</strong> Open Settings → Screen Time → See All Activity on your iPhone</p>
                            </div>
                            
                            <!-- Current Total -->
                            <div class="screentime-total ${isOverGoal ? 'over-goal' : ''}">
                                <div class="total-time">
                                    <span class="time-value">${totalHours}h ${remainingMinutes}m</span>
                                    <span class="time-label">Total Today</span>
                                </div>
                                <div class="goal-status">
                                    ${isOverGoal ?
                                        `<span class="status-warning">⚠️ Over goal by ${Math.floor((totalMinutes - dailyGoal) / 60)}h ${(totalMinutes - dailyGoal) % 60}m</span>` :
                                        `<span class="status-good">✅ ${Math.floor((dailyGoal - totalMinutes) / 60)}h ${(dailyGoal - totalMinutes) % 60}m remaining</span>`
                                    }
                                </div>
                            </div>
                            
                            <!-- Add App Form -->
                            <div class="add-app-form">
                                <h3>Add App</h3>
                                <div class="form-row">
                                    <div class="form-group" style="flex: 2;">
                                        <label for="app-name">App Name</label>
                                        <input type="text" id="app-name" class="input-text"
                                               placeholder="e.g., Instagram, TikTok, Candy Crush...">
                                    </div>
                                    <div class="form-group">
                                        <label for="app-hours">Hours</label>
                                        <input type="number" id="app-hours" class="input-number"
                                               min="0" max="24" value="0">
                                    </div>
                                    <div class="form-group">
                                        <label for="app-minutes">Minutes</label>
                                        <input type="number" id="app-minutes" class="input-number"
                                               min="0" max="59" value="0">
                                    </div>
                                </div>
                                <button type="button" class="btn btn-secondary" onclick="PromptFlow.addScreentimeApp()">
                                    + Add App
                                </button>
                            </div>
                            
                            <!-- Apps List -->
                            ${data.screentimeApps.length > 0 ? `
                                <div class="apps-list">
                                    <h3>Today's Apps</h3>
                                    ${data.screentimeApps.map((app, index) => `
                                        <div class="app-item">
                                            <div class="app-info">
                                                <span class="app-name">${Utils.escapeHtml(app.name)}</span>
                                                <span class="app-time">${Math.floor(app.minutes / 60)}h ${app.minutes % 60}m</span>
                                            </div>
                                            <button type="button" class="btn-icon" onclick="PromptFlow.removeScreentimeApp(${index})">
                                                🗑️
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <div class="empty-apps">
                                    <p>No apps added yet. Add your social media and games above.</p>
                                </div>
                            `}
                            
                            <div class="daily-goal-info">
                                <p>Daily Goal: 1.5 hours (90 minutes)</p>
                            </div>
                        </div>
                    `;
                },
                validate: (data) => {
                    // Data is already stored in data.screentimeApps
                    return true;
                }
            },
            {
                name: 'bedtime-commitment',
                skippable: false,
                render: (data) => {
                    return `
                        <div class="prompt-screen commitment-screen">
                            <h2>🛏️ Bedtime Commitment</h2>
                            <p class="subtitle">When will you be in bed tonight?</p>
                            
                            <div class="form-group">
                                <label for="bedtime">Bedtime</label>
                                <input type="time" id="bedtime" class="input-time input-large" value="23:00" required>
                            </div>
                            
                            <div class="sleep-calculation" id="sleep-calc">
                                <!-- Sleep hours will be calculated here -->
                            </div>
                        </div>
                    `;
                },
                setupListeners: (data) => {
                    const bedtimeInput = document.getElementById('bedtime');
                    const sleepCalc = document.getElementById('sleep-calc');
                    
                    const updateSleepCalc = () => {
                        const bedtime = bedtimeInput.value;
                        const wakeup = data.wakeupCommitment;
                        
                        if (bedtime && wakeup) {
                            let sleepMinutes = Utils.timeDifferenceMinutes(bedtime, wakeup);
                            if (sleepMinutes < 0) sleepMinutes += 24 * 60; // Next day
                            
                            const hours = Math.floor(sleepMinutes / 60);
                            const mins = sleepMinutes % 60;
                            
                            let message = `💤 ${hours}h ${mins}m of sleep`;
                            let className = 'sleep-good';
                            
                            if (hours < 6) {
                                message += ' - ⚠️ That\'s not enough!';
                                className = 'sleep-bad';
                            } else if (hours < 7) {
                                message += ' - Could be better';
                                className = 'sleep-okay';
                            } else if (hours >= 8) {
                                message += ' - Perfect! 👍';
                            }
                            
                            sleepCalc.innerHTML = `<div class="sleep-info ${className}">${message}</div>`;
                        }
                    };
                    
                    bedtimeInput.addEventListener('change', updateSleepCalc);
                    updateSleepCalc();
                },
                validate: (data) => {
                    const bedtime = document.getElementById('bedtime').value;
                    if (!bedtime) {
                        Utils.showError('Please set your bedtime');
                        return false;
                    }
                    data.bedtimeCommitment = bedtime;
                    return true;
                }
            },
            {
                name: 'summary',
                skippable: false,
                render: (data) => {
                    const obligationsHtml = data.obligations && data.obligations.length > 0
                        ? data.obligations.map(o => `<li>${o.carriedOver ? '⚠️ ' : ''}${o.title}</li>`).join('')
                        : '<li class="empty">None set</li>';
                    
                    const prioritiesHtml = data.priorities && data.priorities.length > 0
                        ? data.priorities.map(p => `<li>${p.title}</li>`).join('')
                        : '<li class="empty">None set</li>';
                    
                    return `
                        <div class="prompt-screen summary-screen">
                            <h2>📝 Tomorrow's Plan</h2>
                            <p class="subtitle">Review your commitments before bed.</p>
                            
                            <div class="summary-section">
                                <h3>⏰ Wake-up Time</h3>
                                <p class="summary-value">${Utils.formatTimeString(data.wakeupCommitment)}</p>
                            </div>
                            
                            <div class="summary-section">
                                <h3>📋 Obligations</h3>
                                <ul class="summary-list">${obligationsHtml}</ul>
                            </div>
                            
                            <div class="summary-section">
                                <h3>🎯 Priorities</h3>
                                <ul class="summary-list">${prioritiesHtml}</ul>
                            </div>
                            
                            <div class="summary-section">
                                <h3>🛏️ Bedtime</h3>
                                <p class="summary-value">${Utils.formatTimeString(data.bedtimeCommitment)}</p>
                            </div>
                            
                            <div class="commitment-warning">
                                <p>⚠️ <strong>Remember:</strong> These are binding commitments. You'll face accountability tomorrow morning.</p>
                            </div>
                        </div>
                    `;
                }
            }        
        ];
    },

    /**
     * Add obligation
     */
    addObligation() {
        const title = prompt('Obligation title:');
        if (!title) return;

        const timeInput = prompt('Time (HH:MM) — leave blank for no specific time:');
        const time = timeInput && Utils.isValidTime(timeInput.trim()) ? timeInput.trim() : null;

        this.flowData.obligations = this.flowData.obligations || [];
        this.flowData.obligations.push({
            title: title.trim(),
            time: time,
            completed: false
        });

        this.renderObligations();
    },

    /**
     * Render obligations list
     */
    renderObligations() {
        const list = document.getElementById('obligations-list');
        if (!list) return;
        
        const obligations = this.flowData.obligations || [];
        
        if (obligations.length === 0) {
            list.innerHTML = '<p class="empty-state">No obligations added yet.</p>';
            return;
        }
        
        list.innerHTML = obligations.map((o, i) => `
            <div class="obligation-item ${o.carriedOver ? 'carried-over' : ''}">
                <div class="obligation-info">
                    <span class="obligation-title">${Utils.escapeHtml(o.title)}</span>
                    ${o.carriedOver ? '<span class="carried-tag">⚠️ Carried over</span>' : ''}
                </div>
                <button class="btn-icon" onclick="PromptFlow.removeObligation(${i})" title="Remove">
                    ✕
                </button>
            </div>
        `).join('');
    },

    /**
     * Remove obligation
     */
    removeObligation(index) {
        this.flowData.obligations.splice(index, 1);
        this.renderObligations();
    },

    /**
     * Handle next button
     */
    handleNext() {
        const steps = this.currentFlow === 'morning' 
            ? this.getMorningSteps() 
            : this.currentFlow === 'weekly'
            ? this.getWeeklySteps()
            : this.getEveningSteps();
        const step = steps[this.currentStep];
        
        if (!step) {
            this.completeFlow();
            return;
        }
        
        // Validate current step
        if (step.validate && !step.validate(this.flowData)) {
            return;
        }
        
        // Move to next step
        this.currentStep++;
        this.renderStep();
    },

    /**
     * Handle back button
     */
    handleBack() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    },

    /**
     * Handle skip button
     */
    handleSkip() {
        this.currentStep++;
        this.renderStep();
    },

    /**
     * Complete flow
     */
    completeFlow() {
        if (this.currentFlow === 'morning') {
            this.completeMorningFlow();
        } else if (this.currentFlow === 'evening') {
            this.completeEveningFlow();
        } else if (this.currentFlow === 'weekly') {
            this.completeWeeklyFlow();
        }
    },

    /**
     * Complete morning flow
     */
    completeMorningFlow() {
        const yesterday = Utils.getYesterdayString();
        const today = Utils.getLogDateString();
        
        // Save yesterday's bedtime if provided
        if (this.flowData.actualBedtime) {
            CommitmentTracker.checkCommitment('bedtime', this.flowData.actualBedtime, yesterday);
        }
        
        // Save mood if provided
        if (this.flowData.mood) {
            const today = Utils.getLogDateString();
            const commitment = CommitmentTracker.getTodayCommitment() || CommitmentTracker.setCommitment('mood', this.flowData.mood, today);
            commitment.mood = this.flowData.mood;
            StorageManager.saveCommitments(today, commitment);
        }
        
        // Mark morning check-in complete
        CommitmentTracker.completeMorningCheckin();
        
        // Show success and go to dashboard
        Utils.showSuccess('Morning check-in complete!');
        this.goToDashboard();
    },

    /**
     * Add screentime app
     */
    addScreentimeApp() {
        const name = document.getElementById('app-name').value.trim();
        const hours = parseInt(document.getElementById('app-hours').value) || 0;
        const minutes = parseInt(document.getElementById('app-minutes').value) || 0;
        
        if (!name) {
            Utils.showError('Please enter an app name');
            return;
        }
        
        if (hours === 0 && minutes === 0) {
            Utils.showError('Please enter time for this app');
            return;
        }
        
        const totalMinutes = (hours * 60) + minutes;
        
        if (!this.flowData.screentimeApps) {
            this.flowData.screentimeApps = [];
        }
        
        this.flowData.screentimeApps.push({
            name: name,
            minutes: totalMinutes
        });
        
        // Clear form
        document.getElementById('app-name').value = '';
        document.getElementById('app-hours').value = '0';
        document.getElementById('app-minutes').value = '0';
        
        // Re-render current step to show updated list
        this.renderStep();
    },
    
    /**
     * Remove screentime app
     */
    removeScreentimeApp(index) {
        if (this.flowData.screentimeApps) {
            this.flowData.screentimeApps.splice(index, 1);
            // Re-render current step to show updated list
            this.renderStep();
        }
    },

    /**
     * Complete evening flow
     */
    completeEveningFlow() {
        // Get the current log date (respects 5am boundary)
        const logDate = Utils.getLogDateString();
        
        // Calculate tomorrow's log date (always one day after the current log date)
        const tomorrow = new Date(logDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = Utils.getDateString(tomorrow);

        // Get today's incomplete obligations and carry them over
        const todayCommitment = StorageManager.getCommitments(logDate);
        const incompleteObligations = (todayCommitment?.obligations || [])
            .filter(o => !o.completed)
            .map(o => ({
                title: o.title,
                time: o.time,
                completed: false
            }));
        
        // Merge incomplete obligations with new ones
        const newObligations = this.flowData.obligations || [];
        const allObligations = [...incompleteObligations, ...newObligations];

        // Save commitments
        CommitmentTracker.setCommitment('wakeup', this.flowData.wakeupCommitment, tomorrowStr);
        CommitmentTracker.setCommitment('bedtime', this.flowData.bedtimeCommitment, logDate);
        CommitmentTracker.setCommitment('obligations', allObligations, tomorrowStr);
        CommitmentTracker.setCommitment('priorities', this.flowData.priorities || [], tomorrowStr);

        // Save screentime to the current log date (respects 5am boundary)
        if (this.flowData.screentimeApps && this.flowData.screentimeApps.length > 0) {
            const totalMinutes = this.flowData.screentimeApps.reduce((sum, app) => sum + app.minutes, 0);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const appsList = this.flowData.screentimeApps.map(app =>
                `${app.name} (${Math.floor(app.minutes / 60)}h ${app.minutes % 60}m)`
            ).join(', ');

            ScreentimeTracker.addEntry(logDate, hours, minutes, appsList);
        }

        // Mark evening check-in complete
        CommitmentTracker.completeEveningCheckin();

        Utils.showSuccess('Evening check-in complete! Sleep well! 😴');
        this.goToDashboard();
    },

    /**
     * Complete weekly review flow
     */
    completeWeeklyFlow() {
        // Mark weekly review complete
        CommitmentTracker.completeWeeklyReview();
        
        Utils.showSuccess('Weekly review complete! 🎉');
        this.goToDashboard();
    },
    /**
     * Show prompt container
     */
    showPromptContainer() {
        const promptContainer = document.getElementById('prompt-container');
        const mainApp = document.getElementById('main-app');
        if (promptContainer) promptContainer.style.display = 'block';
        if (mainApp) mainApp.style.display = 'none';
    },

    ratePriority(priorityIndex, rating) {
        if (!this.flowData.priorityRatings) {
            this.flowData.priorityRatings = {};
        }
        this.flowData.priorityRatings[priorityIndex] = rating;
        this.renderStep();
    },

    /**
     * Hide prompt container
     */
    hidePromptContainer() {
        const promptContainer = document.getElementById('prompt-container');
        const mainApp = document.getElementById('main-app');
        if (promptContainer) promptContainer.style.display = 'none';
        if (mainApp) mainApp.style.display = 'grid';
    },

    /**
     * Go to dashboard
     */
    goToDashboard() {
        this.hidePromptContainer();
        // Ensure App is initialized and show dashboard
        if (window.App) {
            if (!window.App.initialized) {
                window.App.init().then(() => {
                    window.App.showDashboard();
                });
            } else {
                window.App.showDashboard();
            }
        }
    },

    toggleEveningObligation(index) {
        const logDate = Utils.getLogDateString();
        const commitment = StorageManager.getCommitments(logDate);
        if (!commitment?.obligations?.[index]) return;
        commitment.obligations[index].completed = !commitment.obligations[index].completed;
        StorageManager.saveCommitments(logDate, commitment);
        // Re-render current step
        this.renderStep();
    },

    walkthroughSkip() {
        if (!this.flowData.walkthrough) return;
        this.flowData.walkthrough.phase = 'skip-duration';
        this.renderStep();
    },

    walkthroughUntilNow() {
        const wt = this.flowData.walkthrough;
        if (!wt || wt.phase !== 'duration') return;
        
        const now = new Date();
        const currentHour = now.getHours();
        
        // Calculate end of day minutes (same logic as render/validate)
        let endOfDayMinutes;
        if (currentHour < 5) {
            endOfDayMinutes = 1440 + (currentHour * 60 + now.getMinutes());
        } else {
            endOfDayMinutes = currentHour * 60 + now.getMinutes();
        }
        
        // Calculate duration from current position to now
        const duration = endOfDayMinutes - wt.currentMinutes;
        
        if (duration <= 0) {
            Utils.showError('Already at current time');
            return;
        }
        
        // Set the duration and move to focus phase
        wt.pendingDuration = duration;
        wt.phase = 'focus';
        this.renderStep();
    },

    walkthroughSetFocus(rating) {
        const wt = this.flowData.walkthrough;
        if (!wt) return;

        const logDate = Utils.getLogDateString();
        const startMinutes = wt.pendingStartMinutes;
        const duration = wt.pendingDuration;

        // Build ISO start/end times for the entry
        const logDateObj = new Date(logDate);
        const startTime = new Date(logDateObj);
        startTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        const endTime = new Date(startTime.getTime() + duration * 60000);

        // Save to time tracker
        TimeTracker.createEntry({
            activity: wt.pendingActivity,
            category: 'work',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            notes: '',
            focusRating: rating
        });

        // Log session in walkthrough state
        wt.sessions.push({
            activity: wt.pendingActivity,
            duration: duration,
            focusRating: rating
        });

        // Advance clock
        wt.currentMinutes += duration;
        wt.pendingActivity = null;
        wt.pendingDuration = null;
        wt.pendingStartMinutes = null;
        
        // Check if we've reached current time
        const now = new Date();
        const currentHour = now.getHours();
        let endOfDayMinutes;
        if (currentHour < 5) {
            endOfDayMinutes = 1440 + (currentHour * 60 + now.getMinutes());
        } else {
            endOfDayMinutes = currentHour * 60 + now.getMinutes();
        }
        
        // If we've reached or passed current time, move to next step
        if (wt.currentMinutes >= endOfDayMinutes) {
            // Walkthrough complete, move to next step
            this.handleNext();
        } else {
            // Continue with more activities
            wt.phase = 'activity';
            this.renderStep();
        }
    },
};

// Make PromptFlow available globally
window.PromptFlow = PromptFlow;

// Made with Bob