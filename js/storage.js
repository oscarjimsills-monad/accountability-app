/**
 * Storage Manager
 * Handles all localStorage operations with error handling
 */

const STORAGE_KEYS = {
    TASKS: 'accountability_tasks',
    HABITS: 'accountability_habits',
    GOALS: 'accountability_goals',
    TIME_ENTRIES: 'accountability_timeEntries',
    REFLECTIONS: 'accountability_reflections',
    COMMITMENTS: 'accountability_commitments',
    SETTINGS: 'accountability_settings',
    LAST_CHECKIN: 'accountability_lastCheckin',
    LAST_EVENING_CHECKIN: 'accountability_lastEveningCheckin',
    USER_NAME: 'accountability_userName',
    WEEKLY_REVIEWS: 'accountability_weeklyReviews',
    LAST_WEEKLY_REVIEW: 'accountability_lastWeeklyReview',
    SHOPPING_LIST: 'accountability_shoppingList',
    PENDING_WEEKLY_REVIEW: 'accountability_pendingWeeklyReview',
    SCREENTIME: 'accountability_screentime'
};

// Local-only sync bookkeeping — deliberately NOT part of STORAGE_KEYS, since
// these describe *this device's* sync state and must never round-trip
// through the cloud (pushing/pulling them would mix up different devices'
// bookkeeping). Used to make sure a cloud pull can never clobber local edits
// that haven't been confirmed pushed yet.
const SYNC_META_KEYS = {
    LAST_EDIT_AT: 'accountability_lastLocalEditAt',
    LAST_SYNCED_AT: 'accountability_lastSyncedAt',
    // The cloud row's own `updated_at` as of the last time *this device*
    // confirmed it — set from the real column value on a pull, or from the
    // timestamp we just wrote on a successful push. This is the correct
    // reference point for "has the cloud moved since I last checked", and
    // is what's shown to the user as "backed up X ago". Left untouched on
    // a failed push, since the cloud genuinely wasn't updated then.
    CLOUD_UPDATED_AT: 'accountability_cloudUpdatedAt',
    // A random ID identifying this browser/storage partition (not physical
    // hardware — two tabs of the same browser share one, a different
    // browser/profile on the same machine gets its own, same as it would
    // get its own separate localStorage). Generated once and persisted;
    // not currently used to gate any decision, just captured for possible
    // future use (e.g. showing "last backed up from iPhone" in the UI).
    DEVICE_ID: 'accountability_deviceId',
    // Which device (by the marker above) made the cloud's current state,
    // as of the last time this device checked — read back from the cloud
    // payload's embedded marker on a pull, or set to our own ID on a push.
    LAST_UPDATED_BY_DEVICE: 'accountability_lastUpdatedByDevice'
};

// Marker key embedded inside the synced `data` blob (not a real
// STORAGE_KEYS entry) identifying which device most recently pushed it.
// Deliberately not part of STORAGE_KEYS so it isn't treated as app data;
// handled separately on push/pull instead.
const CLOUD_DEVICE_MARKER = '__deviceId';

const StorageManager = {
    // Debounce timer for Supabase sync
    _syncTimer: null,
    // Set once a sync failure has been surfaced to the user, so a long
    // offline stretch doesn't spam a toast on every debounced retry
    _syncFailureWarned: false,
    // The specific reason the last sync failed, so the backup modal can
    // show something more useful than a generic "failed, try again" —
    // kept even after the toast itself has been suppressed by the gate above.
    _lastSyncFailureReason: null,

    /**
     * A random ID identifying this browser/storage partition, generated
     * once and persisted forever. Not real device fingerprinting — just a
     * friendly label (coarse platform guess + random suffix) so a future
     * feature could show e.g. "last backed up from iPhone-a3f9e1" without
     * needing anything more invasive than that.
     */
    getDeviceId() {
        let id = localStorage.getItem(SYNC_META_KEYS.DEVICE_ID);
        if (!id) {
            const ua = navigator.userAgent || '';
            const platform = navigator.platform || '';
            let label = 'Device';
            if (/iPad/.test(ua)) label = 'iPad';
            else if (/iPhone/.test(ua)) label = 'iPhone';
            else if (/Android/.test(ua)) label = 'Android';
            else if (/Mac/.test(platform)) label = 'Mac';
            else if (/Win/.test(platform)) label = 'Windows';
            else if (/Linux/.test(platform)) label = 'Linux';
            id = `${label}-${Utils.generateId().slice(-6)}`;
            localStorage.setItem(SYNC_META_KEYS.DEVICE_ID, id);
        }
        return id;
    },

    /**
     * Which device made the cloud's current state, as of the last time
     * this device checked. Null if never synced.
     */
    getLastUpdatedByDevice() {
        return localStorage.getItem(SYNC_META_KEYS.LAST_UPDATED_BY_DEVICE);
    },

    /**
     * Save data to localStorage, then schedule a background Supabase sync
     */
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            localStorage.setItem(SYNC_META_KEYS.LAST_EDIT_AT, new Date().toISOString());
            this.scheduleSyncToSupabase();
            return true;
        } catch (error) {
            console.error('Storage save error:', error);
            if (error.name === 'QuotaExceededError') {
                Utils.showError('Storage quota exceeded. Please export and clear old data.');
            } else {
                Utils.showError('Failed to save data.');
            }
            return false;
        }
    },

    /**
     * Schedule a debounced sync to Supabase (fires 2s after last save)
     */
    scheduleSyncToSupabase() {
        if (this._syncTimer) clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => {
            this.syncToSupabase();
        }, 2000);
    },

    /**
     * Force an immediate sync, bypassing the debounce. Call this before any
     * action that could lose unsaved changes — signing out, or the tab being
     * closed/hidden — since the debounced timer alone won't survive those.
     */
    async flushSyncNow() {
        if (this._syncTimer) {
            clearTimeout(this._syncTimer);
            this._syncTimer = null;
        }
        return await this.syncToSupabase();
    },

    /**
     * Delete this user's row entirely from Supabase. Without this,
     * clear() only wipes localStorage — the next app load pulls the old
     * cloud snapshot straight back via loadFromSupabase(), silently undoing
     * "Delete All Data".
     */
    async clearSupabaseData() {
        try {
            if (!window.AuthManager?.isAuthenticated()) return;
            const user = AuthManager.getUser();
            const { error } = await SupabaseClient.from('user_data').delete().eq('user_id', user.id);
            if (error) console.error('Supabase clear error:', error);
        } catch (error) {
            console.error('Supabase clear error:', error);
        }
    },

    /**
     * Push all localStorage data to Supabase for the current user.
     * Returns true only once the write is actually confirmed present in
     * Supabase (see _verifyCloudWrite) — an upsert call resolving without
     * a client-side error is not treated as proof on its own. Callers rely
     * on this return value to know whether it's now safe to treat the
     * cloud as up to date, and the manual sync button relies on it to
     * decide whether to tell the user their data is really backed up.
     */
    async syncToSupabase() {
        try {
            if (!window.AuthManager?.isAuthenticated()) return false;
            const user = AuthManager.getUser();

            // Collect every accountability_ key into one object
            const data = {};
            Object.values(STORAGE_KEYS).forEach(key => {
                const raw = localStorage.getItem(key);
                if (raw) {
                    try { data[key] = JSON.parse(raw); }
                    catch (e) { data[key] = raw; }
                }
            });
            data[CLOUD_DEVICE_MARKER] = this.getDeviceId();

            const now = new Date().toISOString();
            const { error } = await SupabaseClient
                .from('user_data')
                .upsert({
                    user_id: user.id,
                    data: data,
                    updated_at: now
                }, { onConflict: 'user_id' });

            if (error) {
                console.error('Supabase sync error:', error);
                this._warnSyncFailure(error.message || `Supabase rejected the write (${error.code || 'unknown error'})`);
                return false;
            }

            const confirmed = await this._verifyCloudWrite(user.id, now);
            if (!confirmed) {
                console.error('Supabase sync error: write could not be verified on read-back');
                this._warnSyncFailure("Upload was sent but couldn't be confirmed on read-back");
                return false;
            }

            localStorage.setItem(SYNC_META_KEYS.LAST_SYNCED_AT, now);
            localStorage.setItem(SYNC_META_KEYS.CLOUD_UPDATED_AT, now);
            localStorage.setItem(SYNC_META_KEYS.LAST_UPDATED_BY_DEVICE, this.getDeviceId());
            this._syncFailureWarned = false;
            this._lastSyncFailureReason = null;
            return true;
        } catch (error) {
            console.error('Supabase sync error:', error);
            this._warnSyncFailure(error.message || 'Unexpected error contacting Supabase');
            return false;
        }
    },

    /**
     * Read the row back after a push and confirm Supabase actually has the
     * timestamp we just wrote. An upsert resolving with no error isn't
     * proof enough on its own — this is the actual confirmation.
     *
     * Compares parsed instants, not raw strings: Postgres/PostgREST echoes
     * timestamps back as e.g. "2026-08-06T11:21:20.804+00:00", while
     * JS's toISOString() (what we send) always uses "...804Z" — the exact
     * same instant, different string. A strict string comparison here
     * would fail on literally every sync, which is exactly what happened
     * when this first shipped: every manual backup reported failure even
     * though the underlying write succeeded (data was still reaching
     * other devices via the same upsert).
     */
    async _verifyCloudWrite(userId, expectedUpdatedAt) {
        try {
            const { data, error } = await SupabaseClient
                .from('user_data')
                .select('updated_at')
                .eq('user_id', userId)
                .single();
            if (error || !data?.updated_at) return false;
            return new Date(data.updated_at).getTime() === new Date(expectedUpdatedAt).getTime();
        } catch (error) {
            console.error('Supabase verify error:', error);
            return false;
        }
    },

    /**
     * Surface a sync failure to the user instead of only logging it —
     * silent failures here are exactly what let 3 days of check-ins get
     * lost to a stale cloud pull. The specific reason is always recorded
     * (for the backup modal to show even on a repeat failure), but the
     * toast itself only fires once per offline/failure stretch — reset on
     * the next successful sync — so a long outage doesn't spam a toast on
     * every debounced retry.
     */
    _warnSyncFailure(reason) {
        this._lastSyncFailureReason = reason || null;
        if (this._syncFailureWarned) return;
        this._syncFailureWarned = true;
        const suffix = reason ? ` — ${reason}` : '';
        Utils.showError(`Couldn't back up to the cloud${suffix}. Your changes are saved on this device and will retry automatically.`, 5000);
    },

    /**
     * The specific reason the last sync attempt failed, if any — shown in
     * the backup modal so a failure means something more than "try again".
     */
    getLastSyncFailureReason() {
        return this._lastSyncFailureReason;
    },

    /**
     * Whether this device has local edits that haven't been confirmed
     * pushed to Supabase yet (e.g. saved while offline).
     */
    hasUnsyncedChanges() {
        const lastEditAt = localStorage.getItem(SYNC_META_KEYS.LAST_EDIT_AT);
        if (!lastEditAt) return false;
        const lastSyncedAt = localStorage.getItem(SYNC_META_KEYS.LAST_SYNCED_AT);
        return !lastSyncedAt || lastEditAt > lastSyncedAt;
    },

    /**
     * When the cloud backup was actually last updated (the real Supabase
     * `updated_at` column, not just "when we last checked"). Null if this
     * device has never synced.
     */
    getCloudUpdatedAt() {
        return localStorage.getItem(SYNC_META_KEYS.CLOUD_UPDATED_AT);
    },

    /**
     * Reconcile this device with Supabase by comparing timestamps directly
     * — never by trusting a local "have I synced" flag on its own, and
     * never by comparing against when a local *edit* happened.
     *
     * The correct reference point for "has the cloud moved since I last
     * checked" is CLOUD_UPDATED_AT — the cloud timestamp *this device*
     * last confirmed — not LAST_EDIT_AT (when a local edit happened).
     * Using LAST_EDIT_AT was a real bug: an edit always completes
     * *before* its own push finishes, so right after literally any
     * successful sync, the cloud's updated_at is trivially newer than
     * that edit's own timestamp — on the very same device. That made
     * every single sync look like "the cloud has something newer than
     * me", forcing a reload on every app resume even seconds after
     * backgrounding it. CLOUD_UPDATED_AT doesn't have this problem: a
     * successful push updates it immediately to match the cloud, so a
     * same-device round trip correctly sees "cloud === what I already
     * knew" and does nothing.
     *
     * This also still catches the original bug this replaced: a device
     * that goes dormant right as its last sync attempt was starting
     * (closing the lid, losing signal) has an old CLOUD_UPDATED_AT: the
     * cloud has since moved past it via a different device, so the
     * comparison below correctly triggers a pull instead of letting a
     * revived dormant tab blindly re-push its stale snapshot over
     * newer data — no separate "is this a different device" check needed,
     * since that's exactly what "cloud moved past what I last knew"
     * already means, regardless of which device caused it.
     *
     * Returns one of:
     *   'pull'    — the cloud was newer; local data has been overwritten
     *               with it. The caller MUST treat any already-loaded
     *               in-memory state as stale (a page reload is the
     *               simplest way — see App.resyncOnResume()).
     *   'push'    — this device has an edit unconfirmed against the
     *               (unchanged) cloud; it has been pushed up.
     *   'in-sync' — nothing to do.
     *   'error'   — couldn't reach Supabase; local data left untouched.
     */
    async loadFromSupabase() {
        try {
            if (!window.AuthManager?.isAuthenticated()) return 'error';
            const user = AuthManager.getUser();

            const { data, error } = await SupabaseClient
                .from('user_data')
                .select('data, updated_at')
                .eq('user_id', user.id)
                .single();

            // PGRST116 = no row yet (first login) — that's fine, treat as "cloud has nothing"
            if (error && error.code !== 'PGRST116') {
                console.error('Supabase load error:', error);
                return 'error';
            }

            const cloudUpdatedAt = data?.updated_at || null;
            const myLastKnownCloudUpdatedAt = localStorage.getItem(SYNC_META_KEYS.CLOUD_UPDATED_AT);
            const cloudMs = cloudUpdatedAt ? new Date(cloudUpdatedAt).getTime() : -Infinity;
            const knownMs = myLastKnownCloudUpdatedAt ? new Date(myLastKnownCloudUpdatedAt).getTime() : -Infinity;

            if (cloudMs > knownMs) {
                // Cloud has moved beyond what this device last confirmed —
                // pull it down, whatever caused the move.
                const cloudDeviceId = data?.data?.[CLOUD_DEVICE_MARKER] || null;
                if (data?.data) {
                    Object.entries(data.data).forEach(([key, value]) => {
                        if (key === CLOUD_DEVICE_MARKER) return; // not real app data — handled separately below
                        localStorage.setItem(key, JSON.stringify(value));
                    });
                }
                localStorage.setItem(SYNC_META_KEYS.LAST_SYNCED_AT, new Date().toISOString());
                localStorage.setItem(SYNC_META_KEYS.CLOUD_UPDATED_AT, cloudUpdatedAt);
                if (cloudDeviceId) localStorage.setItem(SYNC_META_KEYS.LAST_UPDATED_BY_DEVICE, cloudDeviceId);
                return 'pull';
            }

            if (this.hasUnsyncedChanges()) {
                // Cloud hasn't moved beyond what we knew, but this device
                // has an edit it hasn't confirmed syncing yet — push it.
                const pushed = await this.syncToSupabase();
                return pushed ? 'push' : 'error';
            }

            return 'in-sync';
        } catch (error) {
            console.error('Supabase load error:', error);
            return 'error';
        }
    },

    /**
     * Load data from localStorage
     */
    load(key) {
        try {
            const serialized = localStorage.getItem(key);
            return serialized ? JSON.parse(serialized) : null;
        } catch (error) {
            console.error('Storage load error:', error);
            Utils.showError('Failed to load data.');
            return null;
        }
    },

    /**
     * Remove item from localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },

    /**
     * Clear all app data
     */
    clear() {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            Object.values(SYNC_META_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    },

    /**
     * Get all tasks
     */
    getTasks() {
        return this.load(STORAGE_KEYS.TASKS) || [];
    },

    /**
     * Save tasks
     */
    saveTasks(tasks) {
        return this.save(STORAGE_KEYS.TASKS, tasks);
    },

    /**
     * Get all habits
     */
    getHabits() {
        return this.load(STORAGE_KEYS.HABITS) || [];
    },

    /**
     * Save habits
     */
    saveHabits(habits) {
        return this.save(STORAGE_KEYS.HABITS, habits);
    },

    /**
     * Get all goals
     */
    getGoals() {
        return this.load(STORAGE_KEYS.GOALS) || [];
    },

    /**
     * Save goals
     */
    saveGoals(goals) {
        return this.save(STORAGE_KEYS.GOALS, goals);
    },

    /**
     * Get all time entries
     */
    getTimeEntries() {
        return this.load(STORAGE_KEYS.TIME_ENTRIES) || [];
    },

    /**
     * Save time entries
     */
    saveTimeEntries(entries) {
        return this.save(STORAGE_KEYS.TIME_ENTRIES, entries);
    },

    /**
     * Get all reflections
     */
    getReflections() {
        return this.load(STORAGE_KEYS.REFLECTIONS) || [];
    },

    /**
     * Save reflections
     */
    saveReflections(reflections) {
        return this.save(STORAGE_KEYS.REFLECTIONS, reflections);
    },

    /**
     * Get commitments for a specific date
     */
    getCommitments(date = Utils.getLogDateString()) {
        const allCommitments = this.load(STORAGE_KEYS.COMMITMENTS) || {};
        return allCommitments[date] || null;
    },

    /**
     * Save commitments for a specific date
     */
    saveCommitments(date, commitments) {
        const allCommitments = this.load(STORAGE_KEYS.COMMITMENTS) || {};
        allCommitments[date] = commitments;
        return this.save(STORAGE_KEYS.COMMITMENTS, allCommitments);
    },

    /**
     * Get all commitments
     */
    getAllCommitments() {
        return this.load(STORAGE_KEYS.COMMITMENTS) || {};
    },

    /**
     * Get settings
     */
    getSettings() {
        const defaults = {
            theme: 'light',
            notifications: true,
            startOfWeek: 0, // Sunday
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '12h',
            gracePeriodMinutes: 15,
            screentimeGoalMinutes: 90
        };
        return { ...defaults, ...this.load(STORAGE_KEYS.SETTINGS) };
    },

    /**
     * Save settings
     */
    saveSettings(settings) {
        return this.save(STORAGE_KEYS.SETTINGS, settings);
    },

    /**
     * Get last check-in date
     */
    getLastCheckin() {
        return this.load(STORAGE_KEYS.LAST_CHECKIN);
    },

    /**
     * Save last check-in date
     */
    saveLastCheckin(date = Utils.getLogDateString()) {
        return this.save(STORAGE_KEYS.LAST_CHECKIN, date);
    },

    /**
     * Get last evening check-in date
     */
    getLastEveningCheckin() {
        return this.load(STORAGE_KEYS.LAST_EVENING_CHECKIN);
    },

    /**
     * Save last evening check-in date
     */
    saveLastEveningCheckin(date = Utils.getLogDateString()) {
        return this.save(STORAGE_KEYS.LAST_EVENING_CHECKIN, date);
    },

    /**
     * Get user name
     */
    getUserName() {
        return this.load(STORAGE_KEYS.USER_NAME) || 'there';
    },

    /**
     * Save user name
     */
    saveUserName(name) {
        return this.save(STORAGE_KEYS.USER_NAME, name);
    },

    /**
     * Export all data
     */
    exportAll() {
        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            data: {
                tasks: this.getTasks(),
                habits: this.getHabits(),
                goals: this.getGoals(),
                timeEntries: this.getTimeEntries(),
                reflections: this.getReflections(),
                commitments: this.getAllCommitments(),
                settings: this.getSettings(),
                userName: this.getUserName(),
                shoppingList: this.getShoppingList(),
                screentime: this.load(STORAGE_KEYS.SCREENTIME) || [],
                weeklyReviews: this.getWeeklyReviews(),
                lastWeeklyReview: this.getLastWeeklyReview(),
                // These three were missing — a restored backup would silently
                // reset morning/evening check-in gating and weekly-review status.
                lastCheckin: this.getLastCheckin(),
                lastEveningCheckin: this.getLastEveningCheckin(),
                pendingWeeklyReview: this.getPendingWeeklyReview()
            }
        };
        return data;
    },

    /**
     * Import data
     */
    importAll(data) {
        try {
            if (!data || !data.data) {
                throw new Error('Invalid data format');
            }

            const {
                tasks, habits, goals, timeEntries, reflections, commitments,
                settings, userName, shoppingList, screentime, weeklyReviews,
                lastWeeklyReview, lastCheckin, lastEveningCheckin, pendingWeeklyReview
            } = data.data;

            if (tasks) this.saveTasks(tasks);
            if (habits) this.saveHabits(habits);
            if (goals) this.saveGoals(goals);
            if (timeEntries) this.saveTimeEntries(timeEntries);
            if (reflections) this.saveReflections(reflections);
            if (commitments) this.save(STORAGE_KEYS.COMMITMENTS, commitments);
            if (settings) this.saveSettings(settings);
            if (userName) this.saveUserName(userName);
            if (shoppingList) this.saveShoppingList(shoppingList);
            if (screentime) this.save(STORAGE_KEYS.SCREENTIME, screentime);
            if (weeklyReviews) this.save(STORAGE_KEYS.WEEKLY_REVIEWS, weeklyReviews);
            if (lastWeeklyReview) this.save(STORAGE_KEYS.LAST_WEEKLY_REVIEW, lastWeeklyReview);
            if (lastCheckin) this.saveLastCheckin(lastCheckin);
            if (lastEveningCheckin) this.saveLastEveningCheckin(lastEveningCheckin);
            if (pendingWeeklyReview) this.savePendingWeeklyReview(pendingWeeklyReview);

            return true;
        } catch (error) {
            console.error('Import error:', error);
            Utils.showError('Failed to import data: ' + error.message);
            return false;
        }
    },

    /**
     * Get storage usage info
     */
    getStorageInfo() {
        let totalSize = 0;
        const info = {};

        Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
            const data = localStorage.getItem(key);
            const size = data ? new Blob([data]).size : 0;
            info[name] = {
                size: size,
                sizeKB: (size / 1024).toFixed(2)
            };
            totalSize += size;
        });

        return {
            items: info,
            totalSize: totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
        };
    },

    /**
     * Check if storage is available
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    },

    getWeeklyReviews() {
        return this.load(STORAGE_KEYS.WEEKLY_REVIEWS) || {};
    },

    saveWeeklyReview(weekKey, review) {
        const reviews = this.getWeeklyReviews();
        reviews[weekKey] = review;
        return this.save(STORAGE_KEYS.WEEKLY_REVIEWS, reviews);
    },

    getLastWeeklyReview() {
        return this.load(STORAGE_KEYS.LAST_WEEKLY_REVIEW);
    },

    saveLastWeeklyReview(weekKey) {
        return this.save(STORAGE_KEYS.LAST_WEEKLY_REVIEW, weekKey);
    },

    getPendingWeeklyReview() {
        return this.load(STORAGE_KEYS.PENDING_WEEKLY_REVIEW);
    },

    savePendingWeeklyReview(weekKey) {
        return this.save(STORAGE_KEYS.PENDING_WEEKLY_REVIEW, weekKey);
    },

    clearPendingWeeklyReview() {
        return this.remove(STORAGE_KEYS.PENDING_WEEKLY_REVIEW);
    },

    /**
     * Get shopping list items
     */
    getShoppingList() {
        return this.load(STORAGE_KEYS.SHOPPING_LIST) || [];
    },

    /**
     * Save shopping list items
     */
    saveShoppingList(items) {
        return this.save(STORAGE_KEYS.SHOPPING_LIST, items);
    },

    /**
     * Export shopping list only
     */
    exportShoppingList() {
        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            type: 'shoppingList',
            data: {
                shoppingList: this.getShoppingList()
            }
        };
        return data;
    },

    /**
     * Import shopping list only
     */
    importShoppingList(data) {
        try {
            if (!data || !data.data || !data.data.shoppingList) {
                throw new Error('Invalid shopping list format');
            }

            const { shoppingList } = data.data;
            this.saveShoppingList(shoppingList);

            return true;
        } catch (error) {
            console.error('Shopping list import error:', error);
            Utils.showError('Failed to import shopping list: ' + error.message);
            return false;
        }
    },
};

// Make StorageManager available globally
window.StorageManager = StorageManager;
window.STORAGE_KEYS = STORAGE_KEYS;

// Made with Bob
