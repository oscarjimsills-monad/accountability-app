/**
 * Prompt Flow Manager
 * Handles morning and evening check-in flows
 */

const PromptFlow = {
    currentFlow: null,
    currentStep: 0,
    flowData: {},
    // Set when the weekly review interrupts an in-progress evening check-in
    // (see handleNext) — holds the evening flow's state so it can resume
    // once the weekly review completes.
    pausedEveningFlow: null,
    
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

    /**
     * Stats for the Mon–Sun week starting at weekKey. Shown on the first
     * weekly-review screen and saved with the review as a snapshot, so
     * History can show how that week actually went.
     *
     * Everything is computed relative to the end of the week being
     * reviewed, not "now" — a catch-up review done a few days late must
     * still describe the right week. Dates are anchored to local noon
     * because a bare YYYY-MM-DD string parses as UTC midnight, which would
     * shift the 7-day window a day for timezones behind UTC.
     */
    getWeeklyStatsSnapshot(weekKey) {
        const weekStartDate = new Date(weekKey + 'T12:00:00');
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const weekEnd = Utils.getDateString(weekEndDate);

        const allCommitments = StorageManager.getAllCommitments();
        let obligationsTotal = 0, obligationsCompleted = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStartDate);
            d.setDate(d.getDate() + i);
            const c = allCommitments[Utils.getDateString(d)];
            if (c?.obligations) {
                obligationsTotal += c.obligations.length;
                obligationsCompleted += c.obligations.filter(o => o.completed).length;
            }
        }

        const weekEntries = TimeTracker.getEntriesByDateRange(weekKey, weekEnd);
        const trackedMinutes = weekEntries.reduce((sum, e) => sum + e.duration, 0);
        const rated = weekEntries.filter(e => e.focusRating);
        const avgFocus = rated.length > 0
            ? Number((rated.reduce((sum, e) => sum + e.focusRating, 0) / rated.length).toFixed(1))
            : null;

        return {
            wakeupRate: CommitmentTracker.calculateWeeklyScore(weekEnd),
            wakeupStreak: CommitmentTracker.calculateWakeupStreak(weekEnd).current,
            obligationsCompleted,
            obligationsTotal,
            trackedMinutes,
            avgFocus
        };
    },

    /**
     * Small "▲ 12%" / "▼ 5%" marker shown under a weekly stat; empty when
     * there's nothing to compare against.
     */
    _statDelta(diff, format) {
        if (diff === null || diff === undefined) return '';
        if (diff === 0) return '<div class="weekly-stat-delta flat">– no change</div>';
        const up = diff > 0;
        return `<div class="weekly-stat-delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${format(Math.abs(diff))}</div>`;
    },

    getWeeklySteps() {
        // The week being reviewed travels with the flow itself, so a stale
        // marker left over from an earlier review can't redirect it
        const weekKey = this.flowData.reviewWeekKey || CommitmentTracker.getPendingWeeklyReviewKey() || CommitmentTracker.getWeekKey();
        // Goals for the week under review (set at the previous Sunday's review)
        const judgedGoals = CommitmentTracker.getGoalsForWeek(weekKey).goals;

        return [
            {
                name: 'weekly-stats',
                skippable: false,
                render: (data) => {
                    const stats = this.getWeeklyStatsSnapshot(weekKey);

                    // Compare with the week before — only if that week actually had data,
                    // otherwise every stat would show a misleading drop to/from zero
                    const prev = this.getWeeklyStatsSnapshot(CommitmentTracker.shiftWeekKey(weekKey, -1));
                    const hasPrev = prev.obligationsTotal > 0 || prev.trackedMinutes > 0 || prev.wakeupRate > 0;
                    const obPct = s => s.obligationsTotal > 0 ? Math.round((s.obligationsCompleted / s.obligationsTotal) * 100) : 0;
                    const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
                    const delta = {
                        wakeup: hasPrev ? stats.wakeupRate - prev.wakeupRate : null,
                        streak: hasPrev ? stats.wakeupStreak - prev.wakeupStreak : null,
                        obligations: hasPrev ? obPct(stats) - obPct(prev) : null,
                        time: hasPrev ? stats.trackedMinutes - prev.trackedMinutes : null,
                        focus: hasPrev && stats.avgFocus !== null && prev.avgFocus !== null
                            ? Number((stats.avgFocus - prev.avgFocus).toFixed(1)) : null
                    };

                    return `
                        <div class="prompt-screen weekly-stats">
                            <h2>📅 Weekly Review</h2>
                            <p class="subtitle">Here's how your week looked.${hasPrev ? ' Arrows show the change since the week before.' : ''}</p>

                            <div class="weekly-stats-grid">
                                <div class="weekly-stat">
                                    <div class="weekly-stat-value">${stats.wakeupRate}%</div>
                                    <div class="weekly-stat-label">Wake-up Rate</div>
                                    ${this._statDelta(delta.wakeup, v => `${v}%`)}
                                </div>
                                <div class="weekly-stat">
                                    <div class="weekly-stat-value">${stats.wakeupStreak}</div>
                                    <div class="weekly-stat-label">Current Streak</div>
                                    ${this._statDelta(delta.streak, v => `${v} day${v === 1 ? '' : 's'}`)}
                                </div>
                                <div class="weekly-stat">
                                    <div class="weekly-stat-value">${obPct(stats)}%</div>
                                    <div class="weekly-stat-label">Obligations Met</div>
                                    ${this._statDelta(delta.obligations, v => `${v}%`)}
                                </div>
                                <div class="weekly-stat">
                                    <div class="weekly-stat-value">${Math.floor(stats.trackedMinutes / 60)}h</div>
                                    <div class="weekly-stat-label">Time Tracked</div>
                                    ${this._statDelta(delta.time, fmtMin)}
                                </div>
                                ${stats.avgFocus ? `
                                    <div class="weekly-stat">
                                        <div class="weekly-stat-value">${stats.avgFocus.toFixed(1)}⭐</div>
                                        <div class="weekly-stat-label">Avg Focus</div>
                                        ${this._statDelta(delta.focus, v => v.toFixed(1))}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }
            },
            // Only when goals were set for this week — mark each one as done / partly / not done
            judgedGoals.length > 0 ? {
                name: 'weekly-goals-review',
                skippable: false,
                render: (data) => {
                    // Start from what was already ticked on the dashboard during the week
                    if (!data.goalJudgments) {
                        data.goalJudgments = judgedGoals.map(g => ({
                            status: g.status || (g.completed ? 'done' : null),
                            note: g.note || ''
                        }));
                    }
                    const options = [['done', '✅ Done'], ['partial', '🟡 Partly'], ['missed', '❌ Not done']];
                    return `
                        <div class="prompt-screen weekly-goals-review">
                            <h2>🎯 This Week's Goals</h2>
                            <p class="subtitle">How did each one go?</p>

                            ${judgedGoals.map((g, i) => `
                                <div class="goal-review-item" data-goal-index="${i}">
                                    <div class="goal-review-title">${Utils.escapeHtml(g.title)}</div>
                                    <div class="focus-options">
                                        ${options.map(([status, label]) => `
                                            <button type="button" class="focus-btn ${data.goalJudgments[i].status === status ? 'selected' : ''}"
                                                    data-status="${status}" onclick="PromptFlow.setGoalStatus(${i}, '${status}')">${label}</button>
                                        `).join('')}
                                    </div>
                                    <input type="text" class="input-text goal-review-note" id="goal-note-${i}"
                                           placeholder="Optional note..." value="${Utils.escapeHtml(data.goalJudgments[i].note)}">
                                </div>
                            `).join('')}
                        </div>
                    `;
                },
                validate: (data) => {
                    judgedGoals.forEach((g, i) => {
                        data.goalJudgments[i].note = document.getElementById(`goal-note-${i}`)?.value.trim() || '';
                    });
                    if (data.goalJudgments.some(j => !j.status)) {
                        Utils.showError('Mark each goal as done, partly done or not done');
                        return false;
                    }
                    return true;
                }
            } : null,
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
                    // Three blank fields by default; add or remove as needed.
                    // Anything typed is kept if you step back and forward.
                    const titles = data.nextGoalTitles && data.nextGoalTitles.length ? data.nextGoalTitles : ['', '', ''];
                    return `
                        <div class="prompt-screen weekly-goals">
                            <h2>🎯 Next Week's Goals</h2>
                            <p class="subtitle">Set the goals for the coming week — three to start, add or remove as you like. You can add more from the dashboard during the week.</p>

                            <div id="weekly-goal-fields">
                                ${titles.map(t => this._goalFieldHtml(t)).join('')}
                            </div>

                            <button type="button" class="btn btn-text" onclick="PromptFlow.addGoalField()">+ Add another goal</button>
                        </div>
                    `;
                },
                setupListeners: () => this._refreshGoalFields(),
                validate: (data) => {
                    const values = Array.from(document.querySelectorAll('.weekly-goal-input')).map(el => el.value.trim());
                    data.nextGoalTitles = values; // remember everything typed, blanks included
                    const goals = values.filter(Boolean).map(title => ({ title, completed: false }));
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
        ].filter(Boolean);
    },

    // ─── Weekly review: goal helpers ─────────────────────────────────────────

    _goalFieldHtml(value = '') {
        return `
            <div class="goal-field">
                <span class="goal-number"></span>
                <input type="text" class="input-text weekly-goal-input" placeholder="A goal for the week" value="${Utils.escapeHtml(value)}">
                <button type="button" class="btn-icon goal-remove-btn" title="Remove this goal" onclick="PromptFlow.removeGoalField(this)">✕</button>
            </div>
        `;
    },

    /** Renumber the goal fields and stop the last remaining one being removed. */
    _refreshGoalFields() {
        const fields = document.querySelectorAll('#weekly-goal-fields .goal-field');
        fields.forEach((field, i) => {
            field.querySelector('.goal-number').textContent = i + 1;
            field.querySelector('.goal-remove-btn').disabled = fields.length === 1;
        });
    },

    addGoalField() {
        const container = document.getElementById('weekly-goal-fields');
        if (!container) return;
        container.insertAdjacentHTML('beforeend', this._goalFieldHtml());
        this._refreshGoalFields();
        container.querySelector('.goal-field:last-child .weekly-goal-input').focus();
    },

    removeGoalField(button) {
        button.closest('.goal-field')?.remove();
        this._refreshGoalFields();
    },

    /** Record done / partly / not done for one of last week's goals and highlight it. */
    setGoalStatus(index, status) {
        const judgment = this.flowData.goalJudgments?.[index];
        if (!judgment) return;
        judgment.status = status;
        document.querySelectorAll(`.goal-review-item[data-goal-index="${index}"] .focus-btn`).forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.status === status);
        });
    },

    /**
     * Get evening flow steps
     */
    getEveningSteps() {
        return [
            // Step 0 — date confirmation
            // The app guesses which day is ending (using the 5am boundary) and asks the
            // user to confirm. This is the single place that sets flowData.confirmedDate —
            // every other evening step reads from that instead of calling getLogDateString().
            {
                name: 'date-confirm',
                skippable: false,
                render: (data) => {
                    const guessed = data.confirmedDate || Utils.getLogDateString();
                    const [y, m, d] = guessed.split('-');
                    const displayDate = `${d}/${m}/${y}`;
                    return `
                        <div class="prompt-screen date-confirm-screen">
                            <h2>🌙 End of Day</h2>
                            <p class="subtitle">The app thinks you're logging the end of <strong>${displayDate}</strong>. Is that right?</p>
                            <div class="form-group">
                                <label for="confirmed-date">Date you're logging for:</label>
                                <input type="date" id="confirmed-date" class="input-text" value="${guessed}">
                            </div>
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.5rem;">
                                Change this if you're logging late — e.g. doing last night's check-in this morning.
                            </p>
                        </div>
                    `;
                },
                setupListeners: (data) => {
                    // Pre-populate confirmedDate from the input so it's always set
                    const input = document.getElementById('confirmed-date');
                    if (input) {
                        data.confirmedDate = input.value || Utils.getLogDateString();
                        input.addEventListener('change', () => {
                            data.confirmedDate = input.value;
                        });
                    }
                },
                validate: (data) => {
                    const input = document.getElementById('confirmed-date');
                    if (input && input.value) data.confirmedDate = input.value;
                    return true;
                }
            },

            {
                name: 'obligations-review',
                skippable: true,
                render: (data) => {
                    const logDate = data.confirmedDate || Utils.getLogDateString();
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
                    const logDate = data.confirmedDate || Utils.getLogDateString();
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
                    const logDate = data.confirmedDate || Utils.getLogDateString();
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
                // Ask what time they went to bed — only when logging a PAST date.
                // If confirmedDate === today's logDate, the current clock is the right
                // ceiling for the walkthrough and this step is skipped automatically.
                name: 'bedtime-capture',
                skippable: false,
                render: (data) => {
                    const confirmedDate = data.confirmedDate || Utils.getLogDateString();
                    const today = Utils.getLogDateString();

                    // Logging today → skip immediately, leave data.logBedtime null
                    // so the walkthrough falls back to the current clock (correct behaviour)
                    if (confirmedDate === today) {
                        data.logBedtime = null;
                        // Defer handleNext so the render cycle completes first
                        setTimeout(() => PromptFlow.handleNext(), 0);
                        return '<div class="prompt-screen" style="display:none"></div>';
                    }

                    const [y, m, d] = confirmedDate.split('-');
                    const displayDate = `${d}/${m}`;
                    const defaultBedtime = data.logBedtime || '00:00';
                    return `
                        <div class="prompt-screen">
                            <h2>🛏️ When did you go to sleep?</h2>
                            <p class="subtitle">End of <strong>${displayDate}</strong> — what time did you actually fall asleep? (Enter the next morning if you went to bed after midnight.)</p>
                            <div class="form-group">
                                <label for="log-bedtime">Bedtime</label>
                                <input type="time" id="log-bedtime" class="input-time input-large"
                                       value="${defaultBedtime}">
                                <p class="help-text">e.g. 23:30 for 11:30pm · 02:00 for 2am · 08:00 for 8am next morning</p>
                            </div>
                        </div>
                    `;
                },
                setupListeners: (data) => {
                    const input = document.getElementById('log-bedtime');
                    if (input) {
                        data.logBedtime = input.value || '00:00';
                        input.addEventListener('change', () => { data.logBedtime = input.value; });
                    }
                },
                validate: (data) => {
                    // Already auto-skipped for today — nothing to validate
                    if (!document.getElementById('log-bedtime')) return true;
                    const input = document.getElementById('log-bedtime');
                    if (input && input.value) data.logBedtime = input.value;
                    if (!data.logBedtime) {
                        Utils.showError('Please enter the time you went to sleep');
                        return false;
                    }
                    return true;
                }
            },

            {
                name: 'day-walkthrough',
                skippable: true,
                render: (data) => this._renderWalkthrough(data),
                setupListeners: (data) => this._setupWalkthrough(data),
                validate: (data) => this._validateWalkthrough(data)
            },

            {
                name: 'habits-review',
                skippable: true,
                render: (data) => {
                    const logDate = data.confirmedDate || Utils.getLogDateString();
                    const habits = HabitManager.getTodayHabits().filter(h => {
                        const created = h.createdDate || Utils.getDateString(new Date(h.createdAt));
                        return created <= logDate;
                    });

                    if (habits.length === 0) return `
                        <div class="prompt-screen habits-review">
                            <h2>✅ Habits</h2>
                            <p class="subtitle">No habits to review for today.</p>
                        </div>
                    `;

                    return `
                        <div class="prompt-screen habits-review">
                            <h2>✅ Habits</h2>
                            <p class="subtitle">Which habits did you complete today?</p>
                            <div class="habits-checklist">
                                ${habits.map(habit => {
                                    const done = HabitManager.isCompleted(habit.id, logDate);
                                    let progress = '';
                                    if (HabitManager.isSubdivided(habit)) {
                                        const doneCount = HabitManager.getSubSlots(habit, logDate).filter(Boolean).length;
                                        progress = `<span class="habit-check-progress">${doneCount}/${habit.subCount}</span>`;
                                    } else if (habit.frequency === 'weekly-count') {
                                        const weekKey = CommitmentTracker.getWeekKey(new Date(logDate + 'T12:00:00'));
                                        const count = HabitManager.countCompletionsInWeek(habit, weekKey);
                                        progress = `<span class="habit-check-progress">${count}/${habit.weeklyTarget} this wk</span>`;
                                    }
                                    return `
                                        <div class="habit-check-item ${done ? 'checked' : ''}"
                                             onclick="PromptFlow.toggleHabitReview('${habit.id}')"
                                             data-habit-id="${habit.id}">
                                            <span class="habit-check-box">${done ? '✓' : ''}</span>
                                            <span class="habit-check-name">${Utils.escapeHtml(habit.name)}</span>
                                            ${progress}
                                            <span class="habit-check-cat">${habit.category}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                },
                setupListeners: (data) => {}
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
                    // Carry forward incomplete obligations from the date just closed
                    // out in THIS session (data.confirmedDate — the same date the
                    // 'obligations-review' step a few screens back just reviewed) —
                    // but only once per flow session (flag prevents re-running on
                    // back/forward).
                    //
                    // This must NOT use StorageManager.getLastEveningCheckin(): that
                    // value is only updated at the very end of completeEveningFlow(),
                    // so mid-flow it still points at the PREVIOUS completed session's
                    // date — one check-in behind — whose obligations were already
                    // carried forward during that earlier session itself. Reading it
                    // here meant "missed" was almost always empty, silently skipping
                    // carry-forward for the obligations just reviewed moments ago.
                    if (!data.obligationsInitialized) {
                        data.obligationsInitialized = true;
                        const logDate = data.confirmedDate || Utils.getLogDateString();
                        const todaysCommitment = StorageManager.getCommitments(logDate);
                        const missed = (todaysCommitment?.obligations || []).filter(o => !o.completed);
                        if (missed.length > 0) {
                            const carried = missed.map(o => ({
                                title: o.title,
                                time: o.time || '',
                                completed: false,
                                carriedOver: true
                            }));
                            // Prepend carried items; keep any the user already added,
                            // skipping duplicates (match by lowercased title).
                            const carriedTitles = new Set(carried.map(o => o.title.toLowerCase()));
                            const userAdded = (data.obligations || []).filter(
                                o => !carriedTitles.has(o.title.toLowerCase())
                            );
                            data.obligations = [...carried, ...userAdded];
                        } else {
                            data.obligations = data.obligations || [];
                        }
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
                    const dailyGoal = StorageManager.getSettings().screentimeGoalMinutes || 90;
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
                                <p>Daily Goal: ${Math.floor(dailyGoal/60)}h${dailyGoal%60>0?` ${dailyGoal%60}m`:''} (${dailyGoal} minutes)</p>
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
                            const sleepMinutes = Utils.timeDifferenceMinutes(bedtime, wakeup);

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

        // Right after the evening check-in's date is confirmed: if that date is
        // a Sunday and this week hasn't been reviewed yet, interrupt the evening
        // flow with the weekly review. The evening flow resumes automatically
        // once the weekly review completes (see completeWeeklyFlow).
        if (this.currentFlow === 'evening' && step.name === 'date-confirm') {
            const confirmedDate = this.flowData.confirmedDate || Utils.getLogDateString();
            const dateObj = new Date(confirmedDate + 'T12:00:00');
            const isSunday = dateObj.getDay() === 0;
            const weekKey = CommitmentTracker.getWeekKey(dateObj);
            // The saved reviews themselves are the source of truth for "already
            // reviewed" — the lastWeeklyReview marker could be pointing at a
            // misfiled week. A goals-only entry (goals added from the dashboard
            // before any review existed) has no completedAt and doesn't count.
            const alreadyReviewed = !!StorageManager.getWeeklyReviews()[weekKey]?.completedAt;

            if (isSunday && !alreadyReviewed) {
                // The week under review is derived from the confirmed date and
                // carried on the flow itself. Previously this only wrote the
                // pending marker if none existed, so a stale marker from an
                // earlier, never-completed review kept redirecting every later
                // review to the wrong week (which is how an Aug 2 review ended
                // up filed under the week of 8 June). Always overwrite it so
                // nothing else can disagree with the flow.
                StorageManager.savePendingWeeklyReview(weekKey);

                this.pausedEveningFlow = {
                    flowData: this.flowData,
                    nextStep: this.currentStep + 1
                };
                this.currentFlow = 'weekly';
                this.currentStep = 0;
                this.flowData = { reviewWeekKey: weekKey };
                this.renderStep();
                return;
            }
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
        // Use the user-confirmed date from step 0, not the clock.
        // This is why we collected it upfront — every downstream save uses it.
        const logDate = this.flowData.confirmedDate || Utils.getLogDateString();

        // Tomorrow is always exactly one calendar day after the confirmed evening date.
        // Obligations and wakeup commitments set tonight apply to the next morning.
        const tomorrow = new Date(logDate + 'T12:00:00');
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = Utils.getDateString(tomorrow);

        // data.obligations already contains carried-over incomplete ones (loaded in setupListeners)
        // plus any new ones the user added — use it directly, no need to merge again
        const allObligations = this.flowData.obligations || [];

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

        // Mark evening check-in complete for the user-confirmed date
        CommitmentTracker.completeEveningCheckin(logDate);

        Utils.showSuccess('Evening check-in complete! Sleep well! 😴');
        this.goToDashboard();
    },

    /**
     * Complete weekly review flow
     */
    completeWeeklyFlow() {
        // Save goals, reflection and a snapshot of the week's stats into the
        // weekly reviews store, under the week this flow was started for
        const weekKey = this.flowData.reviewWeekKey
            || CommitmentTracker.getPendingWeeklyReviewKey()
            || CommitmentTracker.getWeekKey();

        // Write each goal's verdict (done / partly / not done + note) back onto
        // the goal it was about — those live on the previous week's review
        if (this.flowData.goalJudgments) {
            const { storeKey, goals } = CommitmentTracker.getGoalsForWeek(weekKey);
            const judgedReview = StorageManager.getWeeklyReviews()[storeKey];
            if (judgedReview) {
                this.flowData.goalJudgments.forEach((judgment, i) => {
                    const goal = goals[i];
                    if (!goal) return;
                    goal.status = judgment.status;
                    goal.completed = judgment.status === 'done';
                    if (judgment.note) goal.note = judgment.note; else delete goal.note;
                });
                judgedReview.goals = goals;
                StorageManager.saveWeeklyReview(storeKey, judgedReview);
            }
        }

        // Goals added from the dashboard for next week before this review
        // happened (a late review) sit on this week's entry — keep them
        const existingNextGoals = StorageManager.getWeeklyReviews()[weekKey]?.goals || [];
        const review = {
            weekKey,
            completedAt: new Date().toISOString(),
            goals: [...(this.flowData.weeklyGoals || []), ...existingNextGoals],
            wins: this.flowData.weeklyWins || '',
            struggles: this.flowData.weeklyStruggles || '',
            stats: this.getWeeklyStatsSnapshot(weekKey)
        };
        StorageManager.saveWeeklyReview(weekKey, review);

        // Mark weekly review complete (clears pending key)
        CommitmentTracker.completeWeeklyReview(weekKey);

        Utils.showSuccess('Weekly review complete! 🎉');

        // If the weekly review interrupted an evening check-in, resume it
        if (this.pausedEveningFlow) {
            const resume = this.pausedEveningFlow;
            this.pausedEveningFlow = null;
            this.currentFlow = 'evening';
            this.flowData = resume.flowData;
            this.currentStep = resume.nextStep;
            this.renderStep();
            return;
        }

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
        // Use the user-confirmed date, not the clock — same date the rest of the evening flow uses
        const logDate = this.flowData.confirmedDate || Utils.getLogDateString();
        const commitment = StorageManager.getCommitments(logDate);
        if (!commitment?.obligations?.[index]) return;
        const obligation = commitment.obligations[index];

        // Task-sourced obligations: toggle the task itself, which re-syncs this entry
        if (obligation.sourceTaskId) {
            TaskManager.toggleTask(obligation.sourceTaskId);
            this.renderStep();
            return;
        }

        obligation.completed = !obligation.completed;
        StorageManager.saveCommitments(logDate, commitment);
        // Re-render current step
        this.renderStep();
    },

    toggleHabitReview(habitId) {
        const logDate = this.flowData.confirmedDate || Utils.getLogDateString();
        const habit = HabitManager.toggleNextSlot(habitId, logDate);
        // Update the item visually without re-rendering the whole step
        const item = document.querySelector(`.habit-check-item[data-habit-id="${habitId}"]`);
        if (item && habit) {
            const done = HabitManager.isCompleted(habitId, logDate);
            item.classList.toggle('checked', done);
            item.querySelector('.habit-check-box').textContent = done ? '✓' : '';

            const progressEl = item.querySelector('.habit-check-progress');
            if (progressEl) {
                if (HabitManager.isSubdivided(habit)) {
                    const doneCount = HabitManager.getSubSlots(habit, logDate).filter(Boolean).length;
                    progressEl.textContent = `${doneCount}/${habit.subCount}`;
                } else if (habit.frequency === 'weekly-count') {
                    const weekKey = CommitmentTracker.getWeekKey(new Date(logDate + 'T12:00:00'));
                    const count = HabitManager.countCompletionsInWeek(habit, weekKey);
                    progressEl.textContent = `${count}/${habit.weeklyTarget} this wk`;
                }
            }
        }
    },

    // ─── Day walkthrough ─────────────────────────────────────────────────────
    // The day is a set of non-overlapping blocks between its start (wake-up)
    // and its end (bedtime, or now). Whatever isn't covered by a block is a
    // "gap". The prompt always works on one gap — the earliest, unless the
    // user tapped another — and any block can be edited or deleted at any
    // time. Every block (except "can't remember" ones) is backed by a real
    // Time Tracker entry, which is kept in step with it.

    /** Minutes since the log date's midnight → "8:30 AM" (past midnight wraps). */
    _wtClock(minutes) {
        const h = Math.floor(minutes / 60) % 24;
        const m = minutes % 60;
        return Utils.formatTimeString(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    },

    /** Minutes → "HH:MM" for a time input. */
    _wtInputValue(minutes) {
        const h = Math.floor(minutes / 60) % 24;
        return `${String(h).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    },

    /** "HH:MM" → minutes within this day's window; a time before the day's start is after midnight. */
    _wtParseClock(timeStr, dayStart) {
        const [h, m] = timeStr.split(':').map(Number);
        let minutes = h * 60 + m;
        if (minutes < dayStart) minutes += 1440;
        return minutes;
    },

    /**
     * ISO timestamp for a minutes-of-day value on the log date. Anchored to
     * local noon: logDate is a bare YYYY-MM-DD string, which parses as UTC
     * midnight and would put every entry on the previous local day in
     * timezones behind UTC. Hours ≥ 24 roll over to the next day.
     */
    _wtIso(logDate, minutes) {
        const d = new Date(logDate + 'T12:00:00');
        d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return d.toISOString();
    },

    _walkthroughInit(data) {
        const logDate = data.confirmedDate || Utils.getLogDateString();
        const commitment = StorageManager.getCommitments(logDate);
        const wakeupTime = commitment?.wakeup?.actual || commitment?.wakeup?.commitment || '08:00';
        const [wh, wm] = wakeupTime.split(':').map(Number);

        // Time entries already logged for this log day. Entries from the next
        // calendar day before 5am belong to it too; entries before 5am on the
        // log date itself belong to the previous log day.
        const nextDay = new Date(logDate + 'T12:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = Utils.getDateString(nextDay);

        const existingEntries = TimeTracker.timeEntries.filter(entry => {
            const hour = new Date(entry.startTime).getHours();
            if (entry.date === logDate) return hour >= 5;
            if (entry.date === nextDayStr) return hour < 5;
            return false;
        }).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        const sessions = existingEntries.map(entry => {
            const start = new Date(entry.startTime);
            let startMinutes = start.getHours() * 60 + start.getMinutes();
            if (start.getHours() < 5) startMinutes += 1440; // after midnight → next day
            return {
                id: Utils.generateId(),
                entryId: entry.id,
                activity: entry.activity,
                startMinutes,
                duration: entry.duration,
                focusRating: entry.focusRating || null,
                fromTimeTracker: true
            };
        });

        // The day starts at wake-up, or earlier if something was logged before that
        let dayStart = wh * 60 + wm;
        if (sessions.length > 0 && sessions[0].startMinutes < dayStart) dayStart = sessions[0].startMinutes;

        data.walkthrough = {
            logDate,
            dayStart,
            sessions,
            phase: 'activity',       // 'activity' | 'duration' | 'skip-duration' | 'edit'
            target: null,            // start of a gap the user tapped, else the earliest gap is used
            editing: null,           // id of the block being edited
            pendingActivity: null,
            pendingStartMinutes: null,
            pendingRating: null,
            editRating: null
        };
    },

    /** End of the log period in minutes (may pass 1440): the confirmed bedtime for a past day, otherwise now. */
    _walkthroughEnd(data) {
        if (data.logBedtime) {
            const [bh, bm] = data.logBedtime.split(':').map(Number);
            let bedMinutes = bh * 60 + bm;
            const logDate = data.confirmedDate || Utils.getLogDateString();
            const commitment = StorageManager.getCommitments(logDate);
            const wakeupTime = commitment?.wakeup?.actual || commitment?.wakeup?.commitment || '08:00';
            const [wbh, wbm] = wakeupTime.split(':').map(Number);
            // Bedtime at or before wake-up means sleep crossed midnight
            if (bedMinutes <= (wbh * 60 + wbm)) bedMinutes += 1440;
            return bedMinutes;
        }
        const now = new Date();
        const h = now.getHours();
        return h < 5 ? 1440 + h * 60 + now.getMinutes() : h * 60 + now.getMinutes();
    },

    /** Blocks and gaps in chronological order, plus just the gaps. Overlapping blocks are tolerated. */
    _walkthroughLayout(wt, dayEnd) {
        const blocks = [...wt.sessions].sort((a, b) => a.startMinutes - b.startMinutes);
        const items = [];
        const gaps = [];
        let cursor = wt.dayStart;

        const addGap = (start, end) => {
            if (end - start >= 1) {
                const gap = { type: 'gap', start, end };
                items.push(gap);
                gaps.push(gap);
            }
        };

        blocks.forEach(session => {
            if (session.startMinutes > cursor && cursor < dayEnd) addGap(cursor, Math.min(session.startMinutes, dayEnd));
            items.push({ type: 'block', session });
            cursor = Math.max(cursor, session.startMinutes + session.duration);
        });
        if (cursor < dayEnd) addGap(cursor, dayEnd);

        return { items, gaps };
    },

    /** The gap being worked on: the one containing the anchor point, else the earliest. */
    _wtActiveGap(wt, gaps) {
        const anchor = (wt.phase === 'duration' || wt.phase === 'skip-duration') ? wt.pendingStartMinutes : wt.target;
        return (anchor != null && gaps.find(g => g.start <= anchor && anchor < g.end)) || gaps[0] || null;
    },

    /** Optional 1–5 focus rating: tap to select, tap again to clear. */
    _wtRatingRowHtml(selected) {
        const labels = ['Distracted', 'Low', 'Moderate', 'Good', 'Deep'];
        return `
            <div class="form-group wt-rating">
                <label>Focus <span class="optional-tag">(optional)</span></label>
                <div class="focus-options" id="wt-rating-row">
                    ${[1, 2, 3, 4, 5].map(n => `
                        <button type="button" class="focus-btn ${selected === n ? 'selected' : ''}" data-rating="${n}"
                                title="${labels[n - 1]}" onclick="PromptFlow.walkthroughPickRating(${n})">
                            ${n}⭐<span class="focus-label">${labels[n - 1]}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _wtDurationInputsHtml(idPrefix, hours = '', minutes = '') {
        return `
            <div class="form-group">
                <label for="${idPrefix}-hours">Hours</label>
                <input type="number" id="${idPrefix}-hours" class="input-number" min="0" max="24" value="${hours}">
            </div>
            <div class="form-group">
                <label for="${idPrefix}-minutes">Minutes</label>
                <input type="number" id="${idPrefix}-minutes" class="input-number" min="0" max="59" value="${minutes}">
            </div>
        `;
    },

    _renderWalkthrough(data) {
        if (!data.walkthrough) this._walkthroughInit(data);
        const wt = data.walkthrough;
        const dayEnd = this._walkthroughEnd(data);
        const { items, gaps } = this._walkthroughLayout(wt, dayEnd);
        const activeGap = this._wtActiveGap(wt, gaps);
        const editingSession = wt.phase === 'edit' ? wt.sessions.find(s => s.id === wt.editing) : null;

        const totalMinutes = Math.max(0, dayEnd - wt.dayStart);
        const gapMinutes = gaps.reduce((sum, g) => sum + (g.end - g.start), 0);
        const accounted = Math.max(0, totalMinutes - gapMinutes);
        const progressPct = totalMinutes > 0 ? Math.min(100, Math.round((accounted / totalMinutes) * 100)) : 0;
        const trackedCount = wt.sessions.filter(s => s.fromTimeTracker).length;

        // ── The form for whatever is being done right now ──
        let panel;
        if (editingSession) {
            const hours = Math.floor(editingSession.duration / 60) || '';
            const minutes = editingSession.duration % 60 || '';
            panel = `
                <h3>✏️ Edit this entry</h3>
                <p class="subtitle">${this._wtClock(editingSession.startMinutes)} – ${this._wtClock(editingSession.startMinutes + editingSession.duration)}</p>
                ${editingSession.skipped ? '' : `
                    <div class="form-group">
                        <label for="wt-edit-activity">Activity</label>
                        <input type="text" id="wt-edit-activity" class="input-text" value="${Utils.escapeHtml(editingSession.activity)}">
                    </div>
                `}
                <div class="form-row">${this._wtDurationInputsHtml('wt-edit', hours, minutes)}</div>
                ${editingSession.skipped ? '' : this._wtRatingRowHtml(wt.editRating)}
                <div class="wt-edit-actions">
                    <button type="button" class="btn btn-primary" onclick="PromptFlow.handleNext()">Save</button>
                    <button type="button" class="btn btn-secondary" onclick="PromptFlow.walkthroughCancelEdit()">Cancel</button>
                    <button type="button" class="btn btn-danger" onclick="PromptFlow.walkthroughDeleteBlock()">Delete</button>
                </div>
            `;
        } else if (!activeGap) {
            panel = `
                <h3>✅ Day accounted for</h3>
                <p class="subtitle">You've walked through your entire day. Tap any block below to change it, or continue.</p>
            `;
        } else if (wt.phase === 'duration') {
            const free = activeGap.end - wt.pendingStartMinutes;
            panel = `
                <h3>⏱️ How long?</h3>
                <p class="subtitle"><strong>${Utils.escapeHtml(wt.pendingActivity)}</strong></p>
                <div class="form-row wt-time-row">
                    <div class="form-group">
                        <label for="wt-start">Starts at</label>
                        <input type="time" id="wt-start" class="input-time" value="${this._wtInputValue(wt.pendingStartMinutes)}">
                    </div>
                    ${this._wtDurationInputsHtml('wt')}
                </div>
                ${this._wtRatingRowHtml(wt.pendingRating)}
                <p class="help-text">Free until ${this._wtClock(activeGap.end)} (~${Utils.formatMinutes(free)})</p>
                <button type="button" class="btn btn-secondary" onclick="PromptFlow.walkthroughUntilNow()">
                    ${activeGap.end === dayEnd ? 'Until now' : `Until ${this._wtClock(activeGap.end)}`} (${Math.floor(free / 60)}h ${free % 60}m)
                </button>
            `;
        } else if (wt.phase === 'skip-duration') {
            const free = activeGap.end - wt.pendingStartMinutes;
            panel = `
                <h3>⏭️ Skip this period</h3>
                <p class="subtitle">Starting ${this._wtClock(wt.pendingStartMinutes)} — roughly how long was the period you can't remember?</p>
                <div class="form-row">${this._wtDurationInputsHtml('wt-skip')}</div>
                <button type="button" class="btn btn-secondary" onclick="PromptFlow.walkthroughUntilNow()">
                    The whole gap, until ${this._wtClock(activeGap.end)} (${Math.floor(free / 60)}h ${free % 60}m)
                </button>
            `;
        } else {
            panel = `
                <h3>What were you doing?</h3>
                <p class="subtitle">Starting from <strong>${this._wtClock(activeGap.start)}</strong>${gaps.length > 1 || activeGap.end !== dayEnd ? ` — free until ${this._wtClock(activeGap.end)}` : ''}</p>
                <div class="form-group">
                    <label for="wt-activity">Activity</label>
                    <input type="text" id="wt-activity" class="input-text" placeholder="e.g. Slept, Worked on example sheet, Lunch...">
                </div>
                <button type="button" class="btn btn-text" onclick="PromptFlow.walkthroughSkip()">
                    Can't remember this period
                </button>
            `;
        }

        // ── The day so far, as a timeline ──
        const timeline = items.map(item => {
            if (item.type === 'gap') {
                const mins = item.end - item.start;
                const active = !editingSession && activeGap && item.start === activeGap.start;
                return `
                    <div class="tl-item tl-gap ${active ? 'tl-active' : ''}" style="min-height:${Math.max(40, Math.min(110, Math.round(mins * 0.5)))}px"
                         onclick="PromptFlow.walkthroughPickGap(${item.start})">
                        <div class="tl-time">${this._wtClock(item.start)}</div>
                        <div class="tl-body"><span class="tl-gap-label">${active ? '▸ filling this' : '＋ tap to fill'} · ${Utils.formatMinutes(mins)} unaccounted</span></div>
                    </div>
                `;
            }
            const s = item.session;
            return `
                <div class="tl-item tl-block ${s.skipped ? 'tl-skipped' : ''} ${wt.editing === s.id && editingSession ? 'tl-editing' : ''}"
                     style="min-height:${Math.max(48, Math.min(150, Math.round(s.duration * 0.9)))}px" onclick="PromptFlow.walkthroughEdit('${s.id}')">
                    <div class="tl-time">${this._wtClock(s.startMinutes)}</div>
                    <div class="tl-body">
                        <div class="tl-title">${s.skipped ? '❓ Can\'t remember' : Utils.escapeHtml(s.activity)}</div>
                        <div class="tl-meta">${Utils.formatMinutes(s.duration)} · until ${this._wtClock(s.startMinutes + s.duration)}${s.focusRating ? ` · ${'⭐'.repeat(s.focusRating)}` : ''}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="prompt-screen day-walkthrough">
                <h2>🗓️ Walk Through Your Day</h2>

                <div class="walkthrough-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPct}%"></div>
                    </div>
                    <p class="progress-text">${Utils.formatMinutes(accounted)} of ~${Utils.formatMinutes(totalMinutes)} accounted for</p>
                    ${trackedCount > 0 ? `<p class="info-text">✓ ${trackedCount} ${trackedCount === 1 ? 'activity' : 'activities'} already logged from time tracker</p>` : ''}
                </div>

                <div id="wt-form-panel" class="wt-form-panel">${panel}</div>

                <div class="day-timeline" id="wt-timeline">
                    ${timeline}
                    <div class="tl-item tl-end">
                        <div class="tl-time">${this._wtClock(dayEnd)}</div>
                        <div class="tl-body"><span class="tl-gap-label">${data.logBedtime ? 'Bedtime' : 'Now'}</span></div>
                    </div>
                </div>
            </div>
        `;
    },

    _setupWalkthrough(data) {
        const wt = data.walkthrough;
        if (!wt) return;
        // Keep the timeline scrolled to whatever is being worked on
        const timeline = document.getElementById('wt-timeline');
        const focus = timeline?.querySelector('.tl-editing, .tl-active');
        // (a third of the way down, so the earlier part of the day stays visible above it)
        if (timeline && focus) timeline.scrollTop = Math.max(0, focus.offsetTop - timeline.clientHeight / 3);
        // Ready to type — but not when just viewing a block to edit it
        if (wt.phase !== 'edit') document.querySelector('#wt-form-panel input:not([type="time"])')?.focus();
    },

    _validateWalkthrough(data) {
        const wt = data.walkthrough;
        if (!wt) return true;

        if (wt.phase === 'edit') return this._wtSaveEdit(data);

        const dayEnd = this._walkthroughEnd(data);
        const { gaps } = this._walkthroughLayout(wt, dayEnd);
        if (gaps.length === 0) return true; // whole day accounted for — move on

        if (wt.phase === 'activity') {
            const activity = document.getElementById('wt-activity')?.value.trim();
            if (!activity) {
                Utils.showError('Enter an activity or use "Can\'t remember"');
                return false;
            }
            wt.pendingActivity = activity;
            wt.pendingStartMinutes = this._wtActiveGap(wt, gaps).start;
            wt.pendingRating = null;
            wt.phase = 'duration';
            this.renderStep();
            return false; // stay on step, re-render
        }

        if (wt.phase === 'duration') return this._wtCommitBlock(data, false);
        if (wt.phase === 'skip-duration') return this._wtCommitBlock(data, false);
        return true;
    },

    /**
     * Validate the duration form and add the block — a real activity (with its
     * optional rating, saved as a Time Tracker entry) or a "can't remember"
     * period (kept in the walkthrough only). Always returns false: the step
     * re-renders itself rather than moving on.
     */
    _wtCommitBlock(data, untilEnd) {
        const wt = data.walkthrough;
        const skipping = wt.phase === 'skip-duration';
        const { gaps } = this._walkthroughLayout(wt, this._walkthroughEnd(data));

        const startInput = document.getElementById('wt-start');
        const start = !skipping && startInput?.value
            ? this._wtParseClock(startInput.value, wt.dayStart)
            : wt.pendingStartMinutes;
        const gap = gaps.find(g => g.start <= start && start < g.end);
        if (!gap) {
            Utils.showError("That start time isn't in a free part of your day");
            return false;
        }

        let duration;
        if (untilEnd) {
            duration = gap.end - start;
        } else {
            const prefix = skipping ? 'wt-skip' : 'wt';
            const hours = parseInt(document.getElementById(`${prefix}-hours`)?.value) || 0;
            const minutes = parseInt(document.getElementById(`${prefix}-minutes`)?.value) || 0;
            duration = hours * 60 + minutes;
        }
        if (duration <= 0) {
            Utils.showError('Enter a duration greater than 0');
            return false;
        }
        if (start + duration > gap.end) {
            Utils.showError(`Only ${Utils.formatMinutes(gap.end - start)} is free from ${this._wtClock(start)} (until ${this._wtClock(gap.end)})`);
            return false;
        }

        if (skipping) {
            wt.sessions.push({ id: Utils.generateId(), entryId: null, skipped: true, activity: "Can't remember", startMinutes: start, duration, focusRating: null });
        } else {
            const entry = TimeTracker.createEntry({
                activity: wt.pendingActivity,
                category: 'work',
                startTime: this._wtIso(wt.logDate, start),
                endTime: this._wtIso(wt.logDate, start + duration),
                notes: '',
                focusRating: wt.pendingRating
            });
            wt.sessions.push({ id: Utils.generateId(), entryId: entry.id, activity: wt.pendingActivity, startMinutes: start, duration, focusRating: wt.pendingRating });
        }

        wt.pendingActivity = null;
        wt.pendingStartMinutes = null;
        wt.pendingRating = null;
        wt.target = null; // carry on from the earliest gap
        wt.phase = 'activity';
        this.renderStep();
        return false;
    },

    /** Save the edit form, updating the Time Tracker entry behind the block. Always returns false. */
    _wtSaveEdit(data) {
        const wt = data.walkthrough;
        const session = wt.sessions.find(s => s.id === wt.editing);
        if (!session) {
            wt.phase = 'activity';
            wt.editing = null;
            this.renderStep();
            return false;
        }

        const hours = parseInt(document.getElementById('wt-edit-hours')?.value) || 0;
        const minutes = parseInt(document.getElementById('wt-edit-minutes')?.value) || 0;
        const duration = hours * 60 + minutes;
        const activity = session.skipped ? session.activity : document.getElementById('wt-edit-activity')?.value.trim();
        if (!activity) {
            Utils.showError('Enter an activity');
            return false;
        }
        if (duration <= 0) {
            Utils.showError('Enter a duration greater than 0');
            return false;
        }

        // It can grow only into free time: not into the next block, not past the end
        // of the day (and never forced shorter than it already is)
        const dayEnd = this._walkthroughEnd(data);
        const next = wt.sessions
            .filter(s => s !== session && s.startMinutes > session.startMinutes)
            .sort((a, b) => a.startMinutes - b.startMinutes)[0];
        const limit = Math.max((next ? next.startMinutes : dayEnd) - session.startMinutes, session.duration);
        if (duration > limit) {
            Utils.showError(`Only ${Utils.formatMinutes(limit)} is free after ${this._wtClock(session.startMinutes)}${next ? ` (the next entry starts at ${this._wtClock(next.startMinutes)})` : ''}`);
            return false;
        }

        const rating = session.skipped ? null : wt.editRating;
        if (session.entryId) {
            const entry = TimeTracker.timeEntries.find(e => e.id === session.entryId);
            if (entry) {
                TimeTracker.updateEntry(session.entryId, {
                    activity,
                    focusRating: rating,
                    endTime: new Date(new Date(entry.startTime).getTime() + duration * 60000).toISOString()
                });
            } else {
                // The entry was removed elsewhere — re-create it rather than silently losing the block
                const recreated = TimeTracker.createEntry({
                    activity, category: 'work', notes: '', focusRating: rating,
                    startTime: this._wtIso(wt.logDate, session.startMinutes),
                    endTime: this._wtIso(wt.logDate, session.startMinutes + duration)
                });
                session.entryId = recreated.id;
            }
        }

        session.activity = activity;
        session.duration = duration;
        session.focusRating = rating;
        wt.editing = null;
        wt.editRating = null;
        wt.phase = 'activity';
        this.renderStep();
        return false;
    },

    _wtScrollToForm() {
        document.getElementById('wt-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    /** "Can't remember this period" — switch to the skip form for the gap being worked on. */
    walkthroughSkip() {
        const wt = this.flowData.walkthrough;
        if (!wt) return;
        const { gaps } = this._walkthroughLayout(wt, this._walkthroughEnd(this.flowData));
        const gap = this._wtActiveGap(wt, gaps);
        if (!gap) return;
        wt.pendingStartMinutes = gap.start;
        wt.phase = 'skip-duration';
        this.renderStep();
    },

    /** "Until now / until X" — fill the rest of the free period (with whatever rating is selected). */
    walkthroughUntilNow() {
        const wt = this.flowData.walkthrough;
        if (!wt || (wt.phase !== 'duration' && wt.phase !== 'skip-duration')) return;
        this._wtCommitBlock(this.flowData, true);
    },

    /** Tap a gap on the timeline: work on that one next. */
    walkthroughPickGap(startMinutes) {
        const wt = this.flowData.walkthrough;
        if (!wt) return;
        wt.target = startMinutes;
        wt.phase = 'activity';
        wt.editing = null;
        wt.pendingActivity = null;
        this.renderStep();
        this._wtScrollToForm();
    },

    /** Tap a block on the timeline: edit or delete it. */
    walkthroughEdit(id) {
        const wt = this.flowData.walkthrough;
        const session = wt?.sessions.find(s => s.id === id);
        if (!session) return;
        wt.phase = 'edit';
        wt.editing = id;
        wt.editRating = session.focusRating || null;
        this.renderStep();
        this._wtScrollToForm();
    },

    walkthroughCancelEdit() {
        const wt = this.flowData.walkthrough;
        if (!wt) return;
        wt.phase = 'activity';
        wt.editing = null;
        wt.editRating = null;
        this.renderStep();
    },

    /** Delete the block being edited (and its Time Tracker entry), leaving a gap to fill. */
    walkthroughDeleteBlock() {
        const wt = this.flowData.walkthrough;
        const session = wt?.sessions.find(s => s.id === wt.editing);
        if (!session) return;
        const label = session.skipped ? 'this unaccounted period' : `"${session.activity}"`;
        if (!confirm(`Remove ${label} from your day?`)) return;

        if (session.entryId) TimeTracker.deleteEntry(session.entryId);
        wt.sessions = wt.sessions.filter(s => s !== session);
        wt.phase = 'activity';
        wt.editing = null;
        wt.editRating = null;
        wt.target = session.startMinutes; // the freed slot is the natural next thing to fill
        this.renderStep();
    },

    /** Select / clear the optional focus rating on the current form. */
    walkthroughPickRating(rating) {
        const wt = this.flowData.walkthrough;
        if (!wt) return;
        const key = wt.phase === 'edit' ? 'editRating' : 'pendingRating';
        wt[key] = wt[key] === rating ? null : rating;
        document.querySelectorAll('#wt-rating-row .focus-btn').forEach(btn => {
            btn.classList.toggle('selected', Number(btn.dataset.rating) === wt[key]);
        });
    },

};

// Make PromptFlow available globally
window.PromptFlow = PromptFlow;

// Made with Bob