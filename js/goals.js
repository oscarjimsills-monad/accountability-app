/**
 * Goal Management Module
 * Handles long-term goals with milestones
 */

const GoalManager = {
    goals: [],

    /**
     * Initialize goal manager
     */
    init() {
        this.loadGoals();
    },

    /**
     * Load goals from storage
     */
    loadGoals() {
        this.goals = StorageManager.getGoals();
        return this.goals;
    },

    /**
     * Save goals to storage
     */
    saveGoals() {
        return StorageManager.saveGoals(this.goals);
    },

    /**
     * Create a new goal
     */
    createGoal(goalData) {
        const goal = {
            id: Utils.generateId(),
            title: goalData.title,
            description: goalData.description || '',
            category: goalData.category || 'personal',
            startDate: goalData.startDate || Utils.getTodayString(),
            targetDate: goalData.targetDate || null,
            milestones: goalData.milestones || [],
            progress: 0,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            notes: []
        };

        this.goals.push(goal);
        this.saveGoals();
        
        Utils.showSuccess('Goal created!');
        return goal;
    },

    /**
     * Get goal by ID
     */
    getGoal(id) {
        return this.goals.find(goal => goal.id === id);
    },

    /**
     * Update goal
     */
    updateGoal(id, updates) {
        const goal = this.getGoal(id);
        if (!goal) {
            Utils.showError('Goal not found');
            return null;
        }

        Object.assign(goal, updates);
        
        // Recalculate progress if milestones changed
        if (updates.milestones) {
            this.calculateProgress(id);
        }
        
        this.saveGoals();
        Utils.showSuccess('Goal updated!');
        return goal;
    },

    /**
     * Delete goal
     */
    deleteGoal(id) {
        const index = this.goals.findIndex(goal => goal.id === id);
        if (index === -1) {
            Utils.showError('Goal not found');
            return false;
        }

        this.goals.splice(index, 1);
        this.saveGoals();
        
        Utils.showSuccess('Goal deleted!');
        return true;
    },

    /**
     * Toggle goal completion
     */
    toggleGoal(id) {
        const goal = this.getGoal(id);
        if (!goal) return null;

        goal.completed = !goal.completed;
        goal.completedAt = goal.completed ? new Date().toISOString() : null;
        
        this.saveGoals();
        Utils.showSuccess(goal.completed ? 'Goal completed! 🎉' : 'Goal reopened');
        return goal;
    },

    /**
     * Add milestone to goal
     */
    addMilestone(goalId, milestoneData) {
        const goal = this.getGoal(goalId);
        if (!goal) return null;

        const milestone = {
            id: Utils.generateId(),
            title: milestoneData.title,
            completed: false,
            completedAt: null
        };

        goal.milestones.push(milestone);
        this.calculateProgress(goalId);
        this.saveGoals();
        
        return milestone;
    },

    /**
     * Toggle milestone completion
     */
    toggleMilestone(goalId, milestoneId) {
        const goal = this.getGoal(goalId);
        if (!goal) return null;

        const milestone = goal.milestones.find(m => m.id === milestoneId);
        if (!milestone) return null;

        milestone.completed = !milestone.completed;
        milestone.completedAt = milestone.completed ? new Date().toISOString() : null;
        
        this.calculateProgress(goalId);
        this.saveGoals();
        
        return milestone;
    },

    /**
     * Delete milestone
     */
    deleteMilestone(goalId, milestoneId) {
        const goal = this.getGoal(goalId);
        if (!goal) return false;

        const index = goal.milestones.findIndex(m => m.id === milestoneId);
        if (index === -1) return false;

        goal.milestones.splice(index, 1);
        this.calculateProgress(goalId);
        this.saveGoals();
        
        return true;
    },

    /**
     * Calculate goal progress
     */
    calculateProgress(goalId) {
        const goal = this.getGoal(goalId);
        if (!goal) return 0;

        if (goal.milestones.length === 0) {
            goal.progress = 0;
            return 0;
        }

        const completed = goal.milestones.filter(m => m.completed).length;
        goal.progress = Utils.calculatePercentage(completed, goal.milestones.length);
        
        return goal.progress;
    },

    /**
     * Add note to goal
     */
    addNote(goalId, noteText) {
        const goal = this.getGoal(goalId);
        if (!goal) return null;

        const note = {
            id: Utils.generateId(),
            text: noteText,
            createdAt: new Date().toISOString()
        };

        goal.notes.push(note);
        this.saveGoals();
        
        return note;
    },

    /**
     * Delete note
     */
    deleteNote(goalId, noteId) {
        const goal = this.getGoal(goalId);
        if (!goal) return false;

        const index = goal.notes.findIndex(n => n.id === noteId);
        if (index === -1) return false;

        goal.notes.splice(index, 1);
        this.saveGoals();
        
        return true;
    },

    /**
     * Get active goals
     */
    getActiveGoals() {
        return this.goals.filter(goal => !goal.completed);
    },

    /**
     * Get completed goals
     */
    getCompletedGoals() {
        return this.goals.filter(goal => goal.completed);
    },

    /**
     * Get goals by category
     */
    getGoalsByCategory(category) {
        return this.goals.filter(goal => goal.category === category);
    },

    /**
     * Get goal statistics
     */
    getStats() {
        const total = this.goals.length;
        const completed = this.goals.filter(g => g.completed).length;
        const active = total - completed;
        
        let totalProgress = 0;
        this.goals.forEach(goal => {
            totalProgress += goal.progress;
        });
        
        const averageProgress = total > 0 ? Math.round(totalProgress / total) : 0;

        return {
            total,
            active,
            completed,
            completionRate: Utils.calculatePercentage(completed, total),
            averageProgress
        };
    },

    /**
     * Render goal list
     */
    renderGoalList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const goals = this.getActiveGoals();

        if (goals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No goals yet</p>
                    <button class="btn btn-primary" onclick="GoalManager.showCreateGoalModal()">
                        Create Goal
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = goals.map(goal => this.renderGoalCard(goal)).join('');
    },

    /**
     * Render goal card
     */
    renderGoalCard(goal) {
        const progressClass = goal.progress >= 75 ? 'high' : goal.progress >= 50 ? 'medium' : 'low';
        const daysRemaining = goal.targetDate ? Utils.daysBetween(new Date(), goal.targetDate) : null;

        return `
            <div class="goal-card" data-goal-id="${goal.id}">
                <div class="goal-header">
                    <div class="goal-info">
                        <h3 class="goal-title">${Utils.escapeHtml(goal.title)}</h3>
                        <span class="goal-category">${goal.category}</span>
                    </div>
                    <button class="goal-complete-btn" 
                            onclick="GoalManager.toggleGoal('${goal.id}'); GoalManager.refreshCurrentView();"
                            title="Mark as complete">
                        ${goal.completed ? '✓' : '○'}
                    </button>
                </div>
                
                ${goal.description ? `<p class="goal-description">${Utils.escapeHtml(goal.description)}</p>` : ''}
                
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${goal.progress}%"></div>
                    </div>
                    <span class="progress-text">${goal.progress}% complete</span>
                </div>
                
                <div class="goal-milestones">
                    <span class="milestone-count">
                        ${goal.milestones.filter(m => m.completed).length}/${goal.milestones.length} milestones
                    </span>
                    ${daysRemaining !== null ? `
                        <span class="days-remaining ${daysRemaining < 7 ? 'urgent' : ''}">
                            ${daysRemaining} days left
                        </span>
                    ` : ''}
                </div>
                
                <div class="goal-actions">
                    <button class="btn-icon" onclick="GoalManager.showGoalDetails('${goal.id}')" title="Details">
                        📋
                    </button>
                    <button class="btn-icon" onclick="GoalManager.showEditGoalModal('${goal.id}')" title="Edit">
                        ✏️
                    </button>
                    <button class="btn-icon" onclick="GoalManager.confirmDeleteGoal('${goal.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Show create goal modal
     */
    showCreateGoalModal() {
        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="GoalManager.closeModal()">
                <div class="modal-content modal-large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Create Goal</h2>
                        <button class="btn-close" onclick="GoalManager.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="goal-form" onsubmit="GoalManager.handleCreateGoal(event)">
                            <div class="form-group">
                                <label for="goal-title">Goal Title *</label>
                                <input type="text" id="goal-title" class="input-text" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="goal-description">Description</label>
                                <textarea id="goal-description" class="input-textarea" rows="3"></textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="goal-category">Category</label>
                                    <select id="goal-category" class="input-select">
                                        <option value="personal">Personal</option>
                                        <option value="career">Career</option>
                                        <option value="health">Health</option>
                                        <option value="financial">Financial</option>
                                        <option value="learning">Learning</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="goal-target-date">Target Date</label>
                                    <input type="date" id="goal-target-date" class="input-date">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Milestones (optional)</label>
                                <div id="milestones-list"></div>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="GoalManager.addMilestoneInput()">
                                    + Add Milestone
                                </button>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="GoalManager.closeModal()">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    Create Goal
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
     * Add milestone input field
     */
    addMilestoneInput() {
        const list = document.getElementById('milestones-list');
        const index = list.children.length;
        
        const div = document.createElement('div');
        div.className = 'milestone-input';
        div.innerHTML = `
            <input type="text" class="input-text milestone-title" placeholder="Milestone ${index + 1}">
            <button type="button" class="btn-icon" onclick="this.parentElement.remove()">✕</button>
        `;
        list.appendChild(div);
    },

    /**
     * Handle create goal form submission
     */
    handleCreateGoal(event) {
        event.preventDefault();

        const milestoneInputs = document.querySelectorAll('.milestone-title');
        const milestones = Array.from(milestoneInputs)
            .map(input => input.value.trim())
            .filter(title => title.length > 0)
            .map(title => ({
                id: Utils.generateId(),
                title: title,
                completed: false,
                completedAt: null
            }));

        const goalData = {
            title: document.getElementById('goal-title').value.trim(),
            description: document.getElementById('goal-description').value.trim(),
            category: document.getElementById('goal-category').value,
            targetDate: document.getElementById('goal-target-date').value || null,
            milestones: milestones
        };

        this.createGoal(goalData);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Show goal details
     */
    showGoalDetails(goalId) {
        const goal = this.getGoal(goalId);
        if (!goal) return;

        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="GoalManager.closeModal()">
                <div class="modal-content modal-large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>${Utils.escapeHtml(goal.title)}</h2>
                        <button class="btn-close" onclick="GoalManager.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="goal-details">
                            ${goal.description ? `<p class="goal-description">${Utils.escapeHtml(goal.description)}</p>` : ''}
                            
                            <div class="goal-meta">
                                <div class="meta-item">
                                    <strong>Category:</strong> ${goal.category}
                                </div>
                                <div class="meta-item">
                                    <strong>Progress:</strong> ${goal.progress}%
                                </div>
                                ${goal.targetDate ? `
                                    <div class="meta-item">
                                        <strong>Target Date:</strong> ${Utils.formatDate(goal.targetDate)}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div class="milestones-section">
                                <h3>Milestones</h3>
                                ${goal.milestones.length > 0 ? `
                                    <ul class="milestone-list">
                                        ${goal.milestones.map(m => `
                                            <li class="milestone-item ${m.completed ? 'completed' : ''}">
                                                <input type="checkbox" 
                                                       ${m.completed ? 'checked' : ''}
                                                       onchange="GoalManager.toggleMilestone('${goal.id}', '${m.id}'); GoalManager.showGoalDetails('${goal.id}');">
                                                <span>${Utils.escapeHtml(m.title)}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                ` : '<p class="empty-text">No milestones yet</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    },

    /**
     * Show edit goal modal
     */
    showEditGoalModal(goalId) {
        const goal = this.getGoal(goalId);
        if (!goal) return;

        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="GoalManager.closeModal()">
                <div class="modal-content modal-large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Edit Goal</h2>
                        <button class="btn-close" onclick="GoalManager.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="goal-form" onsubmit="GoalManager.handleEditGoal(event, '${goalId}')">
                            <div class="form-group">
                                <label for="goal-title">Goal Title *</label>
                                <input type="text" id="goal-title" class="input-text" value="${Utils.escapeHtml(goal.title)}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="goal-description">Description</label>
                                <textarea id="goal-description" class="input-textarea" rows="3">${Utils.escapeHtml(goal.description)}</textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="goal-category">Category</label>
                                    <select id="goal-category" class="input-select">
                                        <option value="personal" ${goal.category === 'personal' ? 'selected' : ''}>Personal</option>
                                        <option value="career" ${goal.category === 'career' ? 'selected' : ''}>Career</option>
                                        <option value="health" ${goal.category === 'health' ? 'selected' : ''}>Health</option>
                                        <option value="financial" ${goal.category === 'financial' ? 'selected' : ''}>Financial</option>
                                        <option value="learning" ${goal.category === 'learning' ? 'selected' : ''}>Learning</option>
                                        <option value="other" ${goal.category === 'other' ? 'selected' : ''}>Other</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="goal-target-date">Target Date</label>
                                    <input type="date" id="goal-target-date" class="input-date" value="${goal.targetDate || ''}">
                                </div>
                            </div>
                            
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="GoalManager.closeModal()">
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
     * Handle edit goal form submission
     */
    handleEditGoal(event, goalId) {
        event.preventDefault();

        const updates = {
            title: document.getElementById('goal-title').value.trim(),
            description: document.getElementById('goal-description').value.trim(),
            category: document.getElementById('goal-category').value,
            targetDate: document.getElementById('goal-target-date').value || null
        };

        this.updateGoal(goalId, updates);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Confirm delete goal
     */
    confirmDeleteGoal(goalId) {
        const goal = this.getGoal(goalId);
        if (!goal) return;

        if (confirm(`Delete goal "${goal.title}"? This cannot be undone.`)) {
            this.deleteGoal(goalId);
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
     * Refresh current view
     */
    refreshCurrentView() {
        if (window.App && window.App.refreshCurrentView) {
            window.App.refreshCurrentView();
        }
    }
};

// Make GoalManager available globally
window.GoalManager = GoalManager;

// Made with Bob