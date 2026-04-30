/**
 * Data Manager Module
 * Handles data export and import
 */

const DataManager = {
    /**
     * Export all data as JSON
     */
    exportData() {
        try {
            const data = StorageManager.exportAll();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const filename = `accountability-backup-${Utils.getDateString(new Date())}.json`;
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            
            URL.revokeObjectURL(url);
            Utils.showSuccess('Data exported successfully!');
            
            return true;
        } catch (error) {
            console.error('Export error:', error);
            Utils.showError('Failed to export data');
            return false;
        }
    },

    /**
     * Import data from JSON file
     */
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Validate data structure
                    if (!data.data || !data.version) {
                        throw new Error('Invalid backup file format');
                    }
                    
                    // Confirm before importing
                    if (!confirm('This will replace all current data. Continue?')) {
                        resolve(false);
                        return;
                    }
                    
                    // Import data
                    const success = StorageManager.importAll(data);
                    
                    if (success) {
                        Utils.showSuccess('Data imported successfully! Reloading...');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                        resolve(true);
                    } else {
                        throw new Error('Import failed');
                    }
                } catch (error) {
                    console.error('Import error:', error);
                    Utils.showError('Failed to import data: ' + error.message);
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                Utils.showError('Failed to read file');
                reject(new Error('File read error'));
            };
            
            reader.readAsText(file);
        });
    },

    /**
     * Show import dialog
     */
    showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importData(file);
            }
        };
        
        input.click();
    },

    /**
     * Clear all data
     */
    clearAllData() {
        if (!confirm('⚠️ This will delete ALL your data permanently. Are you absolutely sure?')) {
            return false;
        }
        
        if (!confirm('This cannot be undone. Export a backup first if needed. Continue?')) {
            return false;
        }
        
        const success = StorageManager.clear();
        
        if (success) {
            Utils.showSuccess('All data cleared. Reloading...');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            Utils.showError('Failed to clear data');
        }
        
        return success;
    },

    /**
     * Get storage info
     */
    getStorageInfo() {
        return StorageManager.getStorageInfo();
    },

    /**
     * Render settings view
     */
    renderSettings() {
        const container = document.getElementById('main-content');
        if (!container) return;

        const storageInfo = this.getStorageInfo();
        const settings = StorageManager.getSettings();
        const userName = StorageManager.getUserName();

        container.innerHTML = `
            <div class="settings-view">
                <h1>⚙️ Settings</h1>

                <!-- User Settings -->
                <div class="settings-section">
                    <h2>User</h2>
                    <div class="form-group">
                        <label for="user-name">Your Name</label>
                        <input type="text" id="user-name" class="input-text" value="${Utils.escapeHtml(userName)}" 
                               onchange="DataManager.updateUserName(this.value)">
                    </div>
                </div>

                <!-- Accountability Settings -->
                <div class="settings-section">
                    <h2>Accountability</h2>
                    <div class="form-group">
                        <label for="grace-period">Wake-up Grace Period (minutes)</label>
                        <input type="number" id="grace-period" class="input-number" 
                               value="${settings.gracePeriodMinutes}" min="0" max="60"
                               onchange="DataManager.updateGracePeriod(this.value)">
                        <p class="help-text">You won't be marked late if you wake up within this time</p>
                    </div>
                </div>

                <!-- Data Management -->
                <div class="settings-section">
                    <h2>Data Management</h2>
                    
                    <div class="settings-actions">
                        <button class="btn btn-primary" onclick="DataManager.exportData()">
                            📥 Export Data
                        </button>
                        <button class="btn btn-secondary" onclick="DataManager.showImportDialog()">
                            📤 Import Data
                        </button>
                    </div>

                    <div class="storage-info">
                        <h3>Storage Usage</h3>
                        <p>Total: ${storageInfo.totalSizeKB} KB</p>
                        <ul class="storage-breakdown">
                            ${Object.entries(storageInfo.items).map(([name, info]) => `
                                <li>${name}: ${info.sizeKB} KB</li>
                            `).join('')}
                        </ul>
                    </div>
                </div>

                <!-- Danger Zone -->
                <div class="settings-section danger-zone">
                    <h2>⚠️ Danger Zone</h2>
                    <p class="warning-text">These actions cannot be undone!</p>
                    
                    <button class="btn btn-danger" onclick="DataManager.clearAllData()">
                        🗑️ Delete All Data
                    </button>
                </div>

                <!-- About -->
                <div class="settings-section">
                    <h2>About</h2>
                    <p>Accountability App v1.0</p>
                    <p>Built with vanilla JavaScript</p>
                    <p>All data stored locally in your browser</p>
                </div>
            </div>
        `;
    },

    /**
     * Update user name
     */
    updateUserName(name) {
        StorageManager.saveUserName(name.trim() || 'there');
        Utils.showSuccess('Name updated!');
    },

    /**
     * Update grace period
     */
    updateGracePeriod(minutes) {
        const settings = StorageManager.getSettings();
        settings.gracePeriodMinutes = parseInt(minutes) || 15;
        StorageManager.saveSettings(settings);
        Utils.showSuccess('Grace period updated!');
    }
};

// Make DataManager available globally
window.DataManager = DataManager;

// Made with Bob