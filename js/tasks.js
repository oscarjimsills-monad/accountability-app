/**
 * Task Management Module
 * Handles CRUD operations for tasks
 */

const TaskManager = {
    tasks: [],

    /**
     * Initialize task manager
     */
    init() {
        this.loadTasks();
        this.syncAllTaskObligations();
    },

    /**
     * Ensure every dated task has a correctly materialized obligation. Runs
     * on every load — cheap and self-healing, since syncTaskObligation always
     * removes any stale linked entry before re-adding. This is what actually
     * backfills tasks that already had a due date set before this
     * materialization feature existed (createTask/updateTask/toggleTask only
     * sync going forward from when they're called, so a task nobody has
     * touched since would otherwise never get an obligation at all).
     */
    syncAllTaskObligations() {
        this.tasks.forEach(task => {
            if (task.dueDate) {
                CommitmentTracker.syncTaskObligation(task);
            }
        });
    },

    /**
     * Load tasks from storage
     */
    loadTasks() {
        this.tasks = StorageManager.getTasks();
        return this.tasks;
    },

    /**
     * Save tasks to storage
     */
    saveTasks() {
        return StorageManager.saveTasks(this.tasks);
    },

    /**
     * Create a new task
     */
    createTask(taskData) {
        const task = {
            id: Utils.generateId(),
            title: taskData.title,
            description: taskData.description || '',
            priority: taskData.priority || 'medium',
            category: taskData.category || 'personal',
            dueDate: taskData.dueDate || null,
            dueTime: taskData.dueTime || null,
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            tags: taskData.tags || []
        };

        this.tasks.push(task);
        this.saveTasks();
        CommitmentTracker.syncTaskObligation(task);

        Utils.showSuccess('Task created!');
        return task;
    },

    /**
     * Get task by ID
     */
    getTask(id) {
        return this.tasks.find(task => task.id === id);
    },

    /**
     * Update task
     */
    updateTask(id, updates) {
        const task = this.getTask(id);
        if (!task) {
            Utils.showError('Task not found');
            return null;
        }

        Object.assign(task, updates);
        this.saveTasks();
        CommitmentTracker.syncTaskObligation(task);

        Utils.showSuccess('Task updated!');
        return task;
    },

    /**
     * Delete task
     */
    deleteTask(id) {
        const index = this.tasks.findIndex(task => task.id === id);
        if (index === -1) {
            Utils.showError('Task not found');
            return false;
        }

        this.tasks.splice(index, 1);
        this.saveTasks();
        CommitmentTracker.removeTaskObligation(id);

        Utils.showSuccess('Task deleted!');
        return true;
    },

    /**
     * Toggle task completion
     */
    toggleTask(id) {
        const task = this.getTask(id);
        if (!task) return null;

        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date().toISOString() : null;

        this.saveTasks();
        CommitmentTracker.syncTaskObligation(task);
        return task;
    },

    /**
     * Get tasks by filter
     */
    getTasks(filter = {}) {
        let filtered = [...this.tasks];

        // Filter by completion status
        if (filter.completed !== undefined) {
            filtered = filtered.filter(task => task.completed === filter.completed);
        }

        // Filter by category
        if (filter.category) {
            filtered = filtered.filter(task => task.category === filter.category);
        }

        // Filter by priority
        if (filter.priority) {
            filtered = filtered.filter(task => task.priority === filter.priority);
        }

        // Filter by date
        if (filter.date) {
            filtered = filtered.filter(task => {
                if (!task.dueDate) return false;
                return Utils.getDateString(task.dueDate) === filter.date;
            });
        }

        // Filter by search term
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower)
            );
        }

        // Sort
        if (filter.sortBy) {
            filtered.sort((a, b) => {
                switch (filter.sortBy) {
                    case 'priority':
                        const priorityOrder = { high: 0, medium: 1, low: 2 };
                        return priorityOrder[a.priority] - priorityOrder[b.priority];
                    case 'dueDate':
                        if (!a.dueDate) return 1;
                        if (!b.dueDate) return -1;
                        return new Date(a.dueDate) - new Date(b.dueDate);
                    case 'created':
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    default:
                        return 0;
                }
            });
        }

        return filtered;
    },

    /**
     * Get today's tasks
     */
    getTodayTasks() {
        const today = Utils.getLogDateString();
        return this.getTasks({ date: today, completed: false });
    },

    /**
     * Get all incomplete tasks, sorted for the dashboard:
     * overdue first (regardless of priority), then by priority (high→low),
     * then by soonest due date within each priority tier. Tasks with no due
     * date sort last within their tier.
     */
    getAllIncompleteSorted() {
        const today = Utils.getLogDateString();
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const isOverdue = t => !!(t.dueDate && t.dueDate < today);

        return this.tasks
            .filter(t => !t.completed)
            .sort((a, b) => {
                const aOverdue = isOverdue(a);
                const bOverdue = isOverdue(b);
                if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

                const prioDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (prioDiff !== 0) return prioDiff;

                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            });
    },

    /**
     * Get overdue tasks
     */
    getOverdueTasks() {
        const today = Utils.getLogDateString();
        return this.tasks.filter(task => {
            if (task.completed || !task.dueDate) return false;
            return task.dueDate < today;
        });
    },

    /**
     * Get upcoming tasks
     */
    getUpcomingTasks(days = 7) {
        // Compare plain date strings directly — mixing a full "now" timestamp
        // against a date-only dueDate (parsed as UTC midnight) could exclude
        // a task due today once it's afternoon, depending on timezone offset.
        const today = Utils.getLogDateString();
        const future = new Date(today + 'T12:00:00');
        future.setDate(future.getDate() + days);
        const futureStr = Utils.getDateString(future);

        return this.tasks.filter(task => {
            if (task.completed || !task.dueDate) return false;
            return task.dueDate >= today && task.dueDate <= futureStr;
        });
    },

    /**
     * Get task statistics
     */
    getStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const overdue = this.getOverdueTasks().length;
        const today = this.getTodayTasks().length;

        return {
            total,
            completed,
            pending,
            overdue,
            today,
            completionRate: Utils.calculatePercentage(completed, total)
        };
    },

    /**
     * Get tasks by category
     */
    getTasksByCategory() {
        const categories = {};
        
        this.tasks.forEach(task => {
            if (!categories[task.category]) {
                categories[task.category] = [];
            }
            categories[task.category].push(task);
        });

        return categories;
    },

    /**
     * Get tasks by priority
     */
    getTasksByPriority() {
        return {
            high: this.getTasks({ priority: 'high', completed: false }),
            medium: this.getTasks({ priority: 'medium', completed: false }),
            low: this.getTasks({ priority: 'low', completed: false })
        };
    },

    /**
     * Clear completed tasks
     */
    clearCompleted() {
        const beforeCount = this.tasks.length;
        this.tasks = this.tasks.filter(task => !task.completed);
        const removed = beforeCount - this.tasks.length;
        
        this.saveTasks();
        Utils.showSuccess(`Cleared ${removed} completed task${removed !== 1 ? 's' : ''}!`);
        
        return removed;
    },

    /**
     * Render task list
     */
    renderTaskList(containerId, filter = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const tasks = this.getTasks(filter);

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No tasks found</p>
                    <button class="btn btn-primary" onclick="TaskManager.showCreateTaskModal()">
                        Create Task
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = tasks.map(task => this.renderTaskCard(task)).join('');
    },

    /**
     * Render task card
     */
    renderTaskCard(task) {
        const priorityClass = `priority-${task.priority}`;
        const completedClass = task.completed ? 'completed' : '';
        const overdueClass = task.dueDate && task.dueDate < Utils.getLogDateString() && !task.completed ? 'overdue' : '';

        return `
            <div class="task-card ${completedClass} ${overdueClass}" data-task-id="${task.id}">
                <div class="task-header">
                    <input type="checkbox" 
                           class="task-checkbox" 
                           ${task.completed ? 'checked' : ''}
                           onchange="TaskManager.toggleTask('${task.id}'); TaskManager.refreshCurrentView();">
                    <h3 class="task-title">${Utils.escapeHtml(task.title)}</h3>
                    <span class="task-priority ${priorityClass}">${task.priority}</span>
                </div>
                
                ${task.description ? `<p class="task-description">${Utils.escapeHtml(task.description)}</p>` : ''}
                
                <div class="task-footer">
                    <div class="task-meta">
                        <span class="task-category">${task.category}</span>
                        ${task.dueDate ? `<span class="task-due-date">${Utils.formatDate(task.dueDate)}${task.dueTime ? ' at ' + Utils.formatTimeString(task.dueTime) : ''}</span>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="btn-icon" onclick="TaskManager.showEditTaskModal('${task.id}')" title="Edit">
                            ✏️
                        </button>
                        <button class="btn-icon" onclick="TaskManager.confirmDeleteTask('${task.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Show create task modal
     */
    showCreateTaskModal() {
        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="TaskManager.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Create Task</h2>
                        <button class="btn-close" onclick="TaskManager.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="task-form" onsubmit="TaskManager.handleCreateTask(event)">
                            <div class="form-group">
                                <label for="task-title">Title *</label>
                                <input type="text" id="task-title" class="input-text" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="task-description">Description</label>
                                <textarea id="task-description" class="input-textarea" rows="3"></textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="task-priority">Priority</label>
                                    <select id="task-priority" class="input-select">
                                        <option value="low">Low</option>
                                        <option value="medium" selected>Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="task-category">Category</label>
                                    <select id="task-category" class="input-select">
                                        <option value="personal">Personal</option>
                                        <option value="work">Work</option>
                                        <option value="health">Health</option>
                                        <option value="learning">Learning</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="task-due-date">Due Date</label>
                                    <input type="date" id="task-due-date" class="input-date">
                                </div>

                                <div class="form-group">
                                    <label for="task-due-time">Due Time</label>
                                    <input type="time" id="task-due-time" class="input-time">
                                </div>
                            </div>
                            <p class="form-hint">Tasks with a due date automatically appear as an obligation for that day.</p>

                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="TaskManager.closeModal()">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    Create Task
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
     * Show edit task modal
     */
    showEditTaskModal(taskId) {
        const task = this.getTask(taskId);
        if (!task) return;

        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="modal-overlay" onclick="TaskManager.closeModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Edit Task</h2>
                        <button class="btn-close" onclick="TaskManager.closeModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <form id="task-form" onsubmit="TaskManager.handleEditTask(event, '${taskId}')">
                            <div class="form-group">
                                <label for="task-title">Title *</label>
                                <input type="text" id="task-title" class="input-text" value="${Utils.escapeHtml(task.title)}" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="task-description">Description</label>
                                <textarea id="task-description" class="input-textarea" rows="3">${Utils.escapeHtml(task.description)}</textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="task-priority">Priority</label>
                                    <select id="task-priority" class="input-select">
                                        <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                                        <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                                        <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="task-category">Category</label>
                                    <select id="task-category" class="input-select">
                                        <option value="personal" ${task.category === 'personal' ? 'selected' : ''}>Personal</option>
                                        <option value="work" ${task.category === 'work' ? 'selected' : ''}>Work</option>
                                        <option value="health" ${task.category === 'health' ? 'selected' : ''}>Health</option>
                                        <option value="learning" ${task.category === 'learning' ? 'selected' : ''}>Learning</option>
                                        <option value="other" ${task.category === 'other' ? 'selected' : ''}>Other</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="task-due-date">Due Date</label>
                                    <input type="date" id="task-due-date" class="input-date" value="${task.dueDate ? (task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate) : ''}">
                                </div>

                                <div class="form-group">
                                    <label for="task-due-time">Due Time</label>
                                    <input type="time" id="task-due-time" class="input-time" value="${task.dueTime || ''}">
                                </div>
                            </div>
                            <p class="form-hint">Tasks with a due date automatically appear as an obligation for that day.</p>

                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary" onclick="TaskManager.closeModal()">
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
     * Handle create task form submission
     */
    handleCreateTask(event) {
        event.preventDefault();

        const taskData = {
            title: document.getElementById('task-title').value.trim(),
            description: document.getElementById('task-description').value.trim(),
            priority: document.getElementById('task-priority').value,
            category: document.getElementById('task-category').value,
            dueDate: document.getElementById('task-due-date').value || null,
            dueTime: document.getElementById('task-due-time').value || null
        };

        this.createTask(taskData);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Handle edit task form submission
     */
    handleEditTask(event, taskId) {
        event.preventDefault();

        const updates = {
            title: document.getElementById('task-title').value.trim(),
            description: document.getElementById('task-description').value.trim(),
            priority: document.getElementById('task-priority').value,
            category: document.getElementById('task-category').value,
            dueDate: document.getElementById('task-due-date').value || null,
            dueTime: document.getElementById('task-due-time').value || null
        };

        this.updateTask(taskId, updates);
        this.closeModal();
        this.refreshCurrentView();
    },

    /**
     * Confirm delete task
     */
    confirmDeleteTask(taskId) {
        const task = this.getTask(taskId);
        if (!task) return;

        if (confirm(`Delete task "${task.title}"?`)) {
            this.deleteTask(taskId);
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
        // This will be called by the app to refresh the current view
        if (window.App && window.App.refreshCurrentView) {
            window.App.refreshCurrentView();
        }
    }
};

// Make TaskManager available globally
window.TaskManager = TaskManager;

// Made with Bob