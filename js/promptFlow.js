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
        const steps = this.currentFlow === 'morning' ? this.getMorningSteps() : this.getEveningSteps();
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
        return [
            {
                name: 'wake-up-check',
                skippable: false,
                render: (data) => {
                    const today = CommitmentTracker.getTodayCommitment();
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
                    const today = CommitmentTracker.getTodayCommitment();
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
                    
                    const today = CommitmentTracker.getTodayCommitment();
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
                    const today = Utils.getTodayString();
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
    },

    /**
     * Get evening flow steps
     */
    getEveningSteps() {
        return [
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
                    data.obligations = data.obligations || [];
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
                        ? data.obligations.map(o => `<li>${o.title} at ${Utils.formatTimeString(o.time)}</li>`).join('')
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
        
        const time = prompt('Time (HH:MM):', '09:00');
        if (!time || !Utils.isValidTime(time)) {
            Utils.showError('Invalid time format');
            return;
        }
        
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
            <div class="obligation-item">
                <div class="obligation-info">
                    <span class="obligation-title">${Utils.escapeHtml(o.title)}</span>
                    <span class="obligation-time">${Utils.formatTimeString(o.time)}</span>
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
        const steps = this.currentFlow === 'morning' ? this.getMorningSteps() : this.getEveningSteps();
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
        }
    },

    /**
     * Complete morning flow
     */
    completeMorningFlow() {
        const yesterday = Utils.getYesterdayString();
        const today = Utils.getTodayString();
        
        // Save yesterday's bedtime if provided
        if (this.flowData.actualBedtime) {
            CommitmentTracker.checkCommitment('bedtime', this.flowData.actualBedtime, yesterday);
        }
        
        // Save mood if provided
        if (this.flowData.mood) {
            const today = Utils.getTodayString();
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
        const today = Utils.getTodayString();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = Utils.getDateString(tomorrow);
        
        // Save commitments
        CommitmentTracker.setCommitment('wakeup', this.flowData.wakeupCommitment, tomorrowStr); // Tomorrow's wake-up
        CommitmentTracker.setCommitment('bedtime', this.flowData.bedtimeCommitment, today); // Tonight's bedtime
        CommitmentTracker.setCommitment('obligations', this.flowData.obligations || [], tomorrowStr); // Tomorrow's obligations
        CommitmentTracker.setCommitment('priorities', this.flowData.priorities || [], tomorrowStr); // Tomorrow's priorities
        
        // Save today's screentime if provided
        if (this.flowData.screentimeApps && this.flowData.screentimeApps.length > 0) {
            const totalMinutes = this.flowData.screentimeApps.reduce((sum, app) => sum + app.minutes, 0);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const appsList = this.flowData.screentimeApps.map(app =>
                `${app.name} (${Math.floor(app.minutes / 60)}h ${app.minutes % 60}m)`
            ).join(', ');
            
            ScreentimeTracker.addEntry(Utils.getTodayString(), hours, minutes, appsList);
        }
        
        // Mark evening check-in complete
        CommitmentTracker.completeEveningCheckin();
        
        // Show success and go to dashboard
        Utils.showSuccess('Evening check-in complete! Sleep well! 😴');
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
    }
};

// Make PromptFlow available globally
window.PromptFlow = PromptFlow;

// Made with Bob