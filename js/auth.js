/**
 * Auth Manager
 * Handles sign-in (Google, or a passwordless email link/code) and session
 * management via Supabase
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
                const hadUser = !!this.currentUser;
                this.currentUser = session?.user || null;
                if (event === 'SIGNED_OUT') {
                    window.location.reload();
                } else if (!hadUser && this.currentUser) {
                    // Signed in while this page was showing the sign-in screen —
                    // e.g. the emailed link was opened in another tab. Load the app.
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
            // Flush any pending debounced sync first — otherwise edits made in
            // the last couple of seconds are wiped by the clearing below
            // before ever reaching Supabase.
            await StorageManager.flushSyncNow();

            // Signing out wipes this browser's copy, so if the latest changes
            // still haven't reached the cloud they'd be lost for good.
            if (StorageManager.hasUnsyncedChanges() &&
                !confirm("Your latest changes couldn't be backed up to the cloud, and signing out will lose them.\n\nSign out anyway?")) {
                return;
            }

            // Clear local data (and the sync bookkeeping about it) so the next
            // sign-in — same account or a different one — starts from the cloud
            StorageManager.clearLocalAccountData();
            await SupabaseClient.auth.signOut();
            window.location.reload();
        } catch (error) {
            console.error('Sign out error:', error);
            window.location.reload();
        }
    },

    // ── Email sign-in (no password) ─────────────────────────────────────
    // Supabase emails a one-time link (and a code) to the address. The first
    // time an address is used, its account is created automatically.

    _pendingEmail: null,
    _resendTimer: null,

    /** Send the sign-in email for the address typed into the form. */
    async sendEmailLink(event) {
        event?.preventDefault();
        const input = document.getElementById('auth-email');
        const email = input.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showAuthMessage('Please enter a valid email address.');
            input.focus();
            return;
        }
        await this._requestEmail(email);
    },

    /** Send the email again to the address already entered. */
    async resendEmailLink() {
        if (this._pendingEmail) await this._requestEmail(this._pendingEmail);
    },

    async _requestEmail(email) {
        const buttons = document.querySelectorAll('#auth-email-btn, #auth-resend-btn');
        buttons.forEach(b => { b.disabled = true; });
        this.showAuthMessage('');
        try {
            const { error } = await SupabaseClient.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true,
                    emailRedirectTo: window.location.origin + window.location.pathname
                }
            });
            if (error) {
                console.error('Email sign-in error:', error);
                const tooSoon = error.status === 429 || /security purposes|rate limit/i.test(error.message || '');
                this.showAuthMessage(tooSoon
                    ? 'Please wait a minute before asking for another email.'
                    : "Couldn't send the email: " + error.message);
                return;
            }
            this._pendingEmail = email;
            this._showSentView(email);
        } catch (error) {
            console.error('Email sign-in error:', error);
            this.showAuthMessage("Couldn't send the email. Check your connection and try again.");
        } finally {
            buttons.forEach(b => { b.disabled = false; });
            if (this._pendingEmail) this._startResendCooldown();
        }
    },

    /** Sign in with the code from the email (for opening it on another device). */
    async verifyEmailCode(event) {
        event?.preventDefault();
        const token = document.getElementById('auth-code').value.replace(/\D/g, '');
        if (token.length < 6 || !this._pendingEmail) {
            this.showAuthMessage('Enter the code from the email.');
            return;
        }
        const btn = document.getElementById('auth-code-btn');
        btn.disabled = true;
        this.showAuthMessage('');
        try {
            const { error } = await SupabaseClient.auth.verifyOtp({
                email: this._pendingEmail,
                token,
                type: 'email'
            });
            if (error) {
                console.error('Code sign-in error:', error);
                this.showAuthMessage("That code didn't work. Check it and try again, or send a new email.");
                return;
            }
            window.location.reload();
        } catch (error) {
            console.error('Code sign-in error:', error);
            this.showAuthMessage("Couldn't check the code. Check your connection and try again.");
        } finally {
            btn.disabled = false;
        }
    },

    /** Go back from "check your email" to the address box. */
    backToEmail() {
        clearInterval(this._resendTimer);
        this._pendingEmail = null;
        document.getElementById('auth-code').value = '';
        document.getElementById('auth-sent').style.display = 'none';
        document.getElementById('auth-email-form').style.display = '';
        this.showAuthMessage('');
        document.getElementById('auth-email').focus();
    },

    _showSentView(email) {
        document.getElementById('auth-sent-email').textContent = email;
        document.getElementById('auth-email-form').style.display = 'none';
        document.getElementById('auth-sent').style.display = '';
    },

    /** Supabase allows one email per address per minute — show the countdown. */
    _startResendCooldown(seconds = 60) {
        const btn = document.getElementById('auth-resend-btn');
        clearInterval(this._resendTimer);
        let left = seconds;
        const tick = () => {
            btn.disabled = left > 0;
            btn.textContent = left > 0 ? `Resend email (${left}s)` : 'Resend email';
            if (left-- <= 0) clearInterval(this._resendTimer);
        };
        tick();
        this._resendTimer = setInterval(tick, 1000);
    },

    /**
     * A Gmail address might already have an account made with the Google
     * button. Supabase deliberately won't say whether an address is
     * registered, so all we can do is point Gmail users to the safe route.
     */
    updateEmailHint(value) {
        const hint = document.getElementById('auth-gmail-hint');
        if (hint) hint.style.display = /@(gmail|googlemail)\.com\s*$/i.test(value) ? '' : 'none';
    },

    showAuthMessage(text) {
        const el = document.getElementById('auth-message');
        if (!el) return;
        el.textContent = text;
        el.style.display = text ? '' : 'none';
    },

    /**
     * If the emailed link failed (expired, or already used), Supabase sends
     * the person back here with the reason in the URL — show it, tidy the URL.
     */
    showUrlError() {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        if (!params.get('error')) return;
        const expired = params.get('error_code') === 'otp_expired';
        this.showAuthMessage(expired
            ? 'That sign-in link has expired or was already used. Some email apps open links automatically, which uses them up. Enter your email for a new one, or use the code from the email.'
            : (params.get('error_description') || 'Sign-in failed. Please try again.').replace(/\+/g, ' '));
        history.replaceState(null, '', window.location.pathname + window.location.search);
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
