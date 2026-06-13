/**
 * Auth Manager
 * Handles Google OAuth sign-in and session management via Supabase
 */

const AuthManager = {
    currentUser: null,

    /**
     * Initialise — check for an existing session
     * Returns the user object if logged in, null if not
     */
    async init() {
        try {
            const { data: { session } } = await SupabaseClient.auth.getSession();
            this.currentUser = session?.user || null;

            // Listen for future auth state changes (sign in / sign out)
            SupabaseClient.auth.onAuthStateChange((event, session) => {
                this.currentUser = session?.user || null;
                if (event === 'SIGNED_OUT') {
                    window.location.reload();
                }
            });

            return this.currentUser;
        } catch (error) {
            console.error('Auth init error:', error);
            return null;
        }
    },

    /**
     * Sign in with Google — redirects to Google, then back to the app
     */
    async signInWithGoogle() {
        try {
            const { error } = await SupabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            });
            if (error) {
                console.error('Sign in error:', error);
                Utils.showError('Sign in failed: ' + error.message);
            }
        } catch (error) {
            console.error('Sign in error:', error);
            Utils.showError('Sign in failed. Please try again.');
        }
    },

    /**
     * Sign out — clears session and reloads
     */
    async signOut() {
        try {
            await SupabaseClient.auth.signOut();
            // Clear local data on sign out so next user starts fresh
            Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
            window.location.reload();
        } catch (error) {
            console.error('Sign out error:', error);
            window.location.reload();
        }
    },

    /**
     * Get the current user object
     */
    getUser() {
        return this.currentUser;
    },

    /**
     * Get display name — prefers Google name, falls back to email
     */
    getDisplayName() {
        if (!this.currentUser) return '';
        return this.currentUser.user_metadata?.full_name ||
               this.currentUser.user_metadata?.name ||
               this.currentUser.email ||
               '';
    },

    /**
     * Get avatar URL from Google profile
     */
    getAvatarUrl() {
        return this.currentUser?.user_metadata?.avatar_url || null;
    },

    isAuthenticated() {
        return !!this.currentUser;
    }
};

window.AuthManager = AuthManager;
