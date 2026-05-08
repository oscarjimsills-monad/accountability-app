/**
 * Shopping List Manager
 * Handles shopping list functionality with export/import capabilities
 */

const ShoppingListManager = {
    items: [],

    /**
     * Initialize shopping list
     */
    init() {
        this.loadItems();
        this.render();
        this.attachEventListeners();
    },

    /**
     * Load items from storage
     */
    loadItems() {
        this.items = StorageManager.getShoppingList();
    },

    /**
     * Save items to storage
     */
    saveItems() {
        StorageManager.saveShoppingList(this.items);
    },

    /**
     * Add new item
     */
    addItem(name, quantity = '', category = '') {
        if (!name.trim()) {
            Utils.showError('Item name cannot be empty');
            return;
        }

        const item = {
            id: Date.now().toString(),
            name: name.trim(),
            quantity: quantity.trim(),
            category: category.trim(),
            checked: false,
            addedDate: new Date().toISOString()
        };

        this.items.push(item);
        this.saveItems();
        this.render();
        Utils.showSuccess('Item added to shopping list');
    },

    /**
     * Remove item
     */
    removeItem(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.saveItems();
        this.render();
        Utils.showSuccess('Item removed');
    },

    /**
     * Toggle item checked status
     */
    toggleItem(id) {
        const item = this.items.find(item => item.id === id);
        if (item) {
            item.checked = !item.checked;
            this.saveItems();
            this.render();
        }
    },

    /**
     * Update item
     */
    updateItem(id, updates) {
        const item = this.items.find(item => item.id === id);
        if (item) {
            Object.assign(item, updates);
            this.saveItems();
            this.render();
        }
    },

    /**
     * Clear all checked items
     */
    clearChecked() {
        const checkedCount = this.items.filter(item => item.checked).length;
        if (checkedCount === 0) {
            Utils.showError('No checked items to clear');
            return;
        }

        if (confirm(`Remove ${checkedCount} checked item(s)?`)) {
            this.items = this.items.filter(item => !item.checked);
            this.saveItems();
            this.render();
            Utils.showSuccess(`${checkedCount} item(s) removed`);
        }
    },

    /**
     * Clear all items
     */
    clearAll() {
        if (this.items.length === 0) {
            Utils.showError('Shopping list is already empty');
            return;
        }

        if (confirm('Clear entire shopping list?')) {
            this.items = [];
            this.saveItems();
            this.render();
            Utils.showSuccess('Shopping list cleared');
        }
    },

    /**
     * Export shopping list to JSON file
     */
    exportList() {
        if (this.items.length === 0) {
            Utils.showError('Shopping list is empty');
            return;
        }

        const data = StorageManager.exportShoppingList();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `shopping-list-${Utils.getTodayString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Utils.showSuccess('Shopping list exported');
    },

    /**
     * Export shopping list as plain text
     */
    exportAsText() {
        if (this.items.length === 0) {
            Utils.showError('Shopping list is empty');
            return;
        }

        let text = 'Shopping List\n';
        text += `Generated: ${new Date().toLocaleString()}\n`;
        text += '='.repeat(50) + '\n\n';

        // Group by category
        const categorized = {};
        this.items.forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!categorized[cat]) {
                categorized[cat] = [];
            }
            categorized[cat].push(item);
        });

        Object.keys(categorized).sort().forEach(category => {
            text += `${category}:\n`;
            categorized[category].forEach(item => {
                const check = item.checked ? '✓' : '☐';
                const qty = item.quantity ? ` (${item.quantity})` : '';
                text += `  ${check} ${item.name}${qty}\n`;
            });
            text += '\n';
        });

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `shopping-list-${Utils.getTodayString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Utils.showSuccess('Shopping list exported as text');
    },

    /**
     * Import shopping list from JSON file
     */
    importList() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (data.type === 'shoppingList') {
                        // Import only shopping list
                        if (StorageManager.importShoppingList(data)) {
                            this.loadItems();
                            this.render();
                            Utils.showSuccess('Shopping list imported successfully');
                        }
                    } else {
                        Utils.showError('Invalid shopping list file');
                    }
                } catch (error) {
                    console.error('Import error:', error);
                    Utils.showError('Failed to import shopping list');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    },

    /**
     * Render shopping list
     */
    render() {
        const container = document.getElementById('shopping-list-container');
        if (!container) return;

        const uncheckedItems = this.items.filter(item => !item.checked);
        const checkedItems = this.items.filter(item => item.checked);

        container.innerHTML = `
            <div class="shopping-list-header">
                <h2>Shopping List</h2>
                <div class="shopping-list-stats">
                    <span class="stat">${uncheckedItems.length} items</span>
                    <span class="stat">${checkedItems.length} checked</span>
                </div>
            </div>

            <div class="shopping-list-actions">
                <button id="add-item-btn" class="btn btn-primary">
                    <span>➕</span> Add Item
                </button>
                <div class="action-group">
                    <button id="export-list-btn" class="btn btn-secondary">
                        <span>📥</span> Export JSON
                    </button>
                    <button id="export-text-btn" class="btn btn-secondary">
                        <span>📄</span> Export Text
                    </button>
                    <button id="import-list-btn" class="btn btn-secondary">
                        <span>📤</span> Import
                    </button>
                </div>
                <div class="action-group">
                    <button id="clear-checked-btn" class="btn btn-text">
                        Clear Checked
                    </button>
                    <button id="clear-all-btn" class="btn btn-text btn-danger">
                        Clear All
                    </button>
                </div>
            </div>

            <div id="add-item-form" class="add-item-form" style="display: none;">
                <div class="form-group">
                    <input type="text" id="item-name-input" class="form-input" placeholder="Item name *" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <input type="text" id="item-quantity-input" class="form-input" placeholder="Quantity (optional)">
                    </div>
                    <div class="form-group">
                        <input type="text" id="item-category-input" class="form-input" placeholder="Category (optional)">
                    </div>
                </div>
                <div class="form-actions">
                    <button id="save-item-btn" class="btn btn-primary">Save</button>
                    <button id="cancel-item-btn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>

            <div class="shopping-list-content">
                ${this.items.length === 0 ? `
                    <div class="empty-state">
                        <p>🛒 Your shopping list is empty</p>
                        <p class="empty-state-hint">Add items you need to buy throughout the week</p>
                    </div>
                ` : `
                    ${uncheckedItems.length > 0 ? `
                        <div class="shopping-list-section">
                            <h3 class="section-title">To Buy</h3>
                            <div class="shopping-items">
                                ${uncheckedItems.map(item => this.renderItem(item)).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${checkedItems.length > 0 ? `
                        <div class="shopping-list-section">
                            <h3 class="section-title">Checked Off</h3>
                            <div class="shopping-items">
                                ${checkedItems.map(item => this.renderItem(item)).join('')}
                            </div>
                        </div>
                    ` : ''}
                `}
            </div>
        `;
    },

    /**
     * Render individual item
     */
    renderItem(item) {
        return `
            <div class="shopping-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
                <div class="item-checkbox">
                    <input type="checkbox" ${item.checked ? 'checked' : ''} 
                           onchange="ShoppingListManager.toggleItem('${item.id}')">
                </div>
                <div class="item-content">
                    <div class="item-name">${Utils.escapeHtml(item.name)}</div>
                    ${item.quantity || item.category ? `
                        <div class="item-meta">
                            ${item.quantity ? `<span class="item-quantity">${Utils.escapeHtml(item.quantity)}</span>` : ''}
                            ${item.category ? `<span class="item-category">${Utils.escapeHtml(item.category)}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <button class="item-delete" onclick="ShoppingListManager.removeItem('${item.id}')" title="Remove item">
                    ✕
                </button>
            </div>
        `;
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Use event delegation for dynamically created elements
        document.addEventListener('click', (e) => {
            if (e.target.id === 'add-item-btn') {
                this.showAddForm();
            } else if (e.target.id === 'save-item-btn') {
                this.handleSaveItem();
            } else if (e.target.id === 'cancel-item-btn') {
                this.hideAddForm();
            } else if (e.target.id === 'export-list-btn') {
                this.exportList();
            } else if (e.target.id === 'export-text-btn') {
                this.exportAsText();
            } else if (e.target.id === 'import-list-btn') {
                this.importList();
            } else if (e.target.id === 'clear-checked-btn') {
                this.clearChecked();
            } else if (e.target.id === 'clear-all-btn') {
                this.clearAll();
            }
        });

        // Handle Enter key in form
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.closest('#add-item-form')) {
                e.preventDefault();
                this.handleSaveItem();
            }
        });
    },

    /**
     * Show add item form
     */
    showAddForm() {
        const form = document.getElementById('add-item-form');
        if (form) {
            form.style.display = 'block';
            document.getElementById('item-name-input').focus();
        }
    },

    /**
     * Hide add item form
     */
    hideAddForm() {
        const form = document.getElementById('add-item-form');
        if (form) {
            form.style.display = 'none';
            document.getElementById('item-name-input').value = '';
            document.getElementById('item-quantity-input').value = '';
            document.getElementById('item-category-input').value = '';
        }
    },

    /**
     * Handle save item
     */
    handleSaveItem() {
        const name = document.getElementById('item-name-input').value;
        const quantity = document.getElementById('item-quantity-input').value;
        const category = document.getElementById('item-category-input').value;

        if (name.trim()) {
            this.addItem(name, quantity, category);
            this.hideAddForm();
        } else {
            Utils.showError('Please enter an item name');
        }
    }
};

// Make ShoppingListManager available globally
window.ShoppingListManager = ShoppingListManager;

// Made with Bob