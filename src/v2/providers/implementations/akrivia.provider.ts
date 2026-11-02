/**
 * Akrivia HCM Provider
 *
 * Implementation of attendance automation for Akrivia HCM system (Keus platform).
 *
 * Features:
 * - Automatic login with credentials
 * - Navigate to attendance dashboard
 * - Parse today's punch data
 * - Smart check-in/check-out (skips if already done)
 * - Verification with retry logic
 *
 * NOTE (Nov 2026): Akrivia rewrote its web app (Angular -> React). The attendance
 * dashboard no longer has stable ids (#check-in, #checkinRequest, app-root/... XPaths),
 * so the attendance page is located by `data-slot` attributes + visible text instead.
 * The login page ids (#emp_id, #password, #login) are unchanged.
 */

import { Page } from 'puppeteer';
import { BaseAttendanceProvider } from '../base/base.provider';
import { LoginCredentials, LoginResult, LogoutResult } from '../base/provider.interface';
import { AKRIVIA_CONFIG } from '../config/provider.config';

/**
 * Interface for parsed punch data
 */
interface PunchData {
    inTime: string;
    outTime: string;
}

/**
 * Snapshot of the "Attendance logs" card on the attendance dashboard
 */
interface AttendanceCardSnapshot {
    /** Whether the "Attendance logs" card exists on the page */
    cardFound: boolean;
    /** Day rows (Today, Yesterday) - empty while the card is still showing skeletons */
    rows: { heading: string; inTime: string; outTime: string }[];
    /** Text of the Check In button, or null if not rendered (not loaded yet / not eligible) */
    checkButtonText: string | null;
}

/** Marker attribute used to tag elements found by text so Puppeteer can click them */
const CLICK_MARKER = 'data-autopunch';

export class AkriviaProvider extends BaseAttendanceProvider {
    // Selectors for Akrivia HCM
    private readonly SELECTORS = {
        // Login page
        empIdInput: '#emp_id',
        passwordInput: '#password',
        loginButton: '#login',

        // Attendance page (elements tagged by readAttendanceCard / clickDialogButton)
        checkInButton: `[${CLICK_MARKER}="check-button"]`,
        statusDialog: '[data-slot="status-dialog"]',
        dialogConfirmButton: `[${CLICK_MARKER}="dialog-confirm"]`
    };

    // URLs
    private readonly URLS = {
        dashboard: 'https://keus.akriviahcm.com/dashboard/dashboard',
        attendance: 'https://keus.akriviahcm.com/time-attendance/ess-attendance-dashboard'
    };

    constructor() {
        super(AKRIVIA_CONFIG);
    }

    // ==================== HELPER FUNCTIONS ====================

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Read the "Attendance logs" card: today's/yesterday's In and Out times and the Check In button.
     * Also tags the Check In button with CLICK_MARKER so it can be clicked via SELECTORS.checkInButton.
     *
     * NOTE: no named inner functions inside page.evaluate - tsx/esbuild injects a `__name`
     * helper into them which doesn't exist in the browser context.
     */
    private async readAttendanceCard(page: Page): Promise<AttendanceCardSnapshot> {
        return page.evaluate((marker: string) => {
            const card = Array.from(document.querySelectorAll('[data-slot="section-card"]')).find(c =>
                (c.querySelector('[data-slot="card-header"]')?.textContent || '').trim().toLowerCase().includes('attendance logs')
            );
            if (!card) {
                return { cardFound: false, rows: [], checkButtonText: null };
            }

            const button = Array.from(card.querySelectorAll('[data-slot="card-action"] button')).find(b =>
                /check\s*(in|out)/i.test(b.textContent || '')
            );
            if (button) {
                button.setAttribute(marker, 'check-button');
            }

            // card-content > div > [one div per day: heading div + In/Out time rows]
            // Each value sits right before its label: <div>10:52 AM</div><div>In time</div>
            const list = card.querySelector('[data-slot="card-content"]')?.firstElementChild;
            const rows = Array.from(list ? list.children : []).map(row => {
                const leaves = Array.from(row.querySelectorAll('div')).filter(d => d.children.length === 0);
                const inLabel = leaves.find(d => (d.textContent || '').trim().toLowerCase() === 'in time');
                const outLabel = leaves.find(d => (d.textContent || '').trim().toLowerCase() === 'out time');
                return {
                    heading: (row.firstElementChild?.textContent || '').trim(),
                    hasLabels: !!inLabel && !!outLabel,
                    inTime: (inLabel?.previousElementSibling?.textContent || '').trim() || '—',
                    outTime: (outLabel?.previousElementSibling?.textContent || '').trim() || '—'
                };
            })
                // Skeleton placeholders (while loading) have no In/Out time labels
                .filter(r => r.hasLabels)
                .map(r => ({ heading: r.heading, inTime: r.inTime, outTime: r.outTime }));

            return {
                cardFound: true,
                rows,
                checkButtonText: button ? (button.textContent || '').trim() : null
            };
        }, CLICK_MARKER);
    }

    /**
     * Poll the attendance card until `ready(snapshot)` is true or the timeout elapses.
     *
     * @returns the last snapshot read (check `ready` again if you need to know whether it timed out)
     */
    private async waitForAttendanceCard(
        page: Page,
        ready: (snapshot: AttendanceCardSnapshot) => boolean,
        maxWaitMs: number,
        pollMs = 1000
    ): Promise<AttendanceCardSnapshot> {
        const startTime = Date.now();
        let snapshot: AttendanceCardSnapshot = { cardFound: false, rows: [], checkButtonText: null };

        while (Date.now() - startTime < maxWaitMs) {
            try {
                snapshot = await this.readAttendanceCard(page);
                if (ready(snapshot)) {
                    return snapshot;
                }
            } catch (error) {
                // Page may be mid-navigation/re-render - keep polling
            }
            await this.sleep(pollMs);
        }

        return snapshot;
    }

    /**
     * Parse today's punch in/out times from the attendance dashboard
     *
     * @param page - Puppeteer page object
     * @returns Promise<PunchData> - Object with inTime and outTime
     */
    private async parseTodaysPunches(page: Page): Promise<PunchData> {
        console.log(`[${this.getName()}] Parsing today's punches from Attendance logs card...`);

        const snapshot = await this.waitForAttendanceCard(page, s => s.rows.length > 0, this.config.timeoutMs);

        if (!snapshot.cardFound) {
            throw new Error('"Attendance logs" card not found on attendance dashboard');
        }
        if (snapshot.rows.length === 0) {
            throw new Error('"Attendance logs" card did not finish loading (no In/Out time rows found)');
        }

        // First row is "Today, DD-Mon-YYYY", second is "Yesterday DD-Mon-YYYY"
        const today = snapshot.rows[0];
        if (!today.heading.toLowerCase().includes('today')) {
            console.log(`[${this.getName()}] First row is NOT today (Found: "${today.heading}"). Assuming no punches for today.`);
            return { inTime: '—', outTime: '—' };
        }

        console.log(`[${this.getName()}] Parsed data for "${today.heading}" - In: "${today.inTime}", Out: "${today.outTime}"`);
        return { inTime: today.inTime, outTime: today.outTime };
    }

    /**
     * Check if user is already punched in
     *
     * @param inTime - In time string from punch card
     * @returns boolean - true if punched in, false if not
     */
    private isPunchedIn(inTime: string): boolean {
        return inTime !== '—' &&
            inTime.trim() !== '—' &&
            inTime.length > 0 &&
            !inTime.includes('—');
    }

    /**
     * Check if user is already punched out
     *
     * @param outTime - Out time string from punch card
     * @returns boolean - true if punched out, false if not
     */
    private isPunchedOut(outTime: string): boolean {
        return outTime !== '—' &&
            outTime.trim() !== '—' &&
            outTime.length > 0 &&
            !outTime.includes('—');
    }

    /**
     * Perform authentication and navigate to attendance dashboard
     * Common logic shared between login and logout
     *
     * @param credentials - User credentials
     * @returns Promise<void>
     */
    private async authenticateAndNavigate(credentials: LoginCredentials): Promise<void> {
        // Phase 1: Navigate to login page
        console.log(`[${this.getName()}] Navigating to login page...`);
        await this.page!.goto(this.config.loginUrl, {
            waitUntil: 'networkidle0',
            timeout: this.config.timeoutMs
        });

        // Phase 2: Enter credentials
        console.log(`[${this.getName()}] Entering credentials...`);
        await this.page!.waitForSelector(this.SELECTORS.empIdInput, { timeout: this.config.timeoutMs });
        await this.page!.type(this.SELECTORS.empIdInput, credentials.userId);

        await this.page!.waitForSelector(this.SELECTORS.passwordInput, { timeout: this.config.timeoutMs });
        await this.page!.type(this.SELECTORS.passwordInput, credentials.password);

        // Phase 3 + 4: Click login button and wait for dashboard redirect
        // (wait is registered before the click so a fast redirect can't be missed)
        console.log(`[${this.getName()}] Clicking login button and waiting for dashboard redirect...`);
        await Promise.all([
            this.page!.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: this.config.timeoutMs
            }),
            this.page!.click(this.SELECTORS.loginButton)
        ]);

        // Verify we're on the dashboard
        const currentUrl = this.page!.url();
        if (!currentUrl.includes('dashboard')) {
            throw new Error('Failed to navigate to dashboard - login may have failed');
        }

        // Phase 5: Navigate to Attendance Dashboard directly
        // (the old sidebar menu ids / XPath no longer exist after the redesign)
        console.log(`[${this.getName()}] Navigating to attendance dashboard...`);
        await this.page!.goto(this.URLS.attendance, {
            waitUntil: 'networkidle0',
            timeout: this.config.timeoutMs
        });

        // Verify we're on attendance dashboard (an expired session would bounce to /login)
        const attendanceUrl = this.page!.url();
        if (!attendanceUrl.includes('attendance-dashboard')) {
            throw new Error(`Failed to navigate to attendance dashboard (landed on ${attendanceUrl})`);
        }

        console.log(`[${this.getName()}] Successfully authenticated and navigated to attendance dashboard`);
    }

    /**
     * Read the state and text of the confirmation/status dialog, if open
     */
    private async readStatusDialog(): Promise<{ status: string | null; text: string } | null> {
        return this.page!.evaluate((selector: string) => {
            const dialog = document.querySelector(selector) as HTMLElement | null;
            if (!dialog) return null;
            return {
                status: dialog.getAttribute('data-status'),
                text: (dialog.innerText || '').replace(/\s+/g, ' ').trim()
            };
        }, this.SELECTORS.statusDialog);
    }

    /**
     * Find the "Confirm" button inside the status dialog and tag it with CLICK_MARKER
     * so it can be clicked via SELECTORS.dialogConfirmButton
     *
     * @returns true if the button was found
     */
    private async tagDialogConfirmButton(): Promise<boolean> {
        return this.page!.evaluate((selector: string, marker: string) => {
            const dialogEl = document.querySelector(selector);
            const button = Array.from(dialogEl ? dialogEl.querySelectorAll('button') : [])
                .find(b => (b.textContent || '').trim().toLowerCase() === 'confirm');
            if (!button) return false;
            button.setAttribute(marker, 'dialog-confirm');
            return true;
        }, this.SELECTORS.statusDialog, CLICK_MARKER);
    }

    /**
     * Execute check-in or check-out action
     *
     * Flow on the redesigned page:
     *   "Check In" button (same button for in & out)
     *     -> status dialog, data-status="confirm" ("Hit the confirm button to register your punch")
     *     -> "Confirm"
     *     -> data-status="loading" -> "success" ("Good to go") | "failed" (error message)
     *
     * @returns Promise<void>
     */
    private async executeCheckAction(): Promise<void> {
        // Wait for the Check In button (rendered only after eligibility loads)
        console.log(`[${this.getName()}] Waiting for Check In button...`);
        const snapshot = await this.waitForAttendanceCard(this.page!, s => s.checkButtonText !== null, 30000);
        if (snapshot.checkButtonText === null) {
            throw new Error('Check In button not found - web punching may not be enabled for this user, or the page did not load');
        }

        console.log(`[${this.getName()}] Clicking "${snapshot.checkButtonText}" button...`);
        await this.page!.click(this.SELECTORS.checkInButton);

        // Wait for confirmation dialog
        console.log(`[${this.getName()}] Waiting for confirmation dialog...`);
        await this.page!.waitForSelector(this.SELECTORS.statusDialog, { visible: true, timeout: 15000 });
        await this.sleep(1000);

        const dialog = await this.readStatusDialog();
        if (!dialog || dialog.status !== 'confirm') {
            // e.g. "failed" straight away when location is required but unavailable
            throw new Error(`Confirmation dialog not in confirm state (status: ${dialog?.status}): ${dialog?.text}`);
        }

        // Tag and click the Confirm button
        const confirmFound = await this.tagDialogConfirmButton();

        if (!confirmFound) {
            throw new Error(`Confirm button not found in dialog: ${dialog.text}`);
        }

        console.log(`[${this.getName()}] Clicking Confirm button...`);
        await this.page!.click(this.SELECTORS.dialogConfirmButton);

        // Wait for the punch request to finish
        const startTime = Date.now();
        while (Date.now() - startTime < this.config.timeoutMs) {
            await this.sleep(1000);
            const state = await this.readStatusDialog();

            if (!state) {
                // Dialog closed by itself - let verification decide
                console.log(`[${this.getName()}] Dialog closed after confirm`);
                return;
            }
            if (state.status === 'success') {
                console.log(`[${this.getName()}] Punch registered: ${state.text}`);
                return;
            }
            if (state.status === 'failed') {
                throw new Error(`Punch failed: ${state.text}`);
            }
        }

        throw new Error('Timed out waiting for punch confirmation result');
    }

    /**
     * Verify punch action success by refreshing and checking punch data
     *
     * @param checkType - 'login' or 'logout'
     * @returns Promise<boolean> - true if verified, false otherwise
     */
    private async verifyPunchSuccess(checkType: 'login' | 'logout'): Promise<boolean> {
        // Retry loop: max ~30s, check every 5s (6 attempts)
        const maxRetries = 6;
        const retryDelay = 5000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`[${this.getName()}] Verification attempt ${attempt}/${maxRetries} - refreshing page...`);

            try {
                await this.page!.reload({ waitUntil: 'networkidle0', timeout: this.config.timeoutMs });

                const punchData = await this.parseTodaysPunches(this.page!);

                if (checkType === 'login' && this.isPunchedIn(punchData.inTime)) {
                    console.log(`[${this.getName()}] Login verified - In time: ${punchData.inTime}`);
                    return true;
                }
                if (checkType === 'logout' && this.isPunchedOut(punchData.outTime)) {
                    console.log(`[${this.getName()}] Logout verified - Out time: ${punchData.outTime}`);
                    return true;
                }

                console.log(`[${this.getName()}] ${checkType} not verified yet, retrying...`);
            } catch (error) {
                console.log(`[${this.getName()}] Verification read failed (${error instanceof Error ? error.message : error}), retrying...`);
            }

            if (attempt < maxRetries) {
                await this.sleep(retryDelay);
            }
        }

        return false;
    }

    // ==================== PUBLIC INTERFACE METHODS ====================


    /**
     * Execute login and attendance check-in for Akrivia HCM
     * 
     * Complete implementation following the AKRIVIA_IMPLEMENTATION.md guide:
     * 1. Navigate to login page and authenticate
     * 2. Navigate to attendance dashboard
     * 3. Parse today's punch data
     * 4. Check if already logged in
     * 5. If not logged in, execute check-in action
     * 6. Verify success
     * 
     * @param {LoginCredentials} credentials - User credentials
     * @returns {Promise<LoginResult>} Result of login attempt
     */
    async login(credentials: LoginCredentials): Promise<LoginResult> {
        try {
            // Initialize browser if not already done
            if (!this.page) {
                await this.initialize();
            }

            console.log(`[${this.getName()}] ========================================`);
            console.log(`[${this.getName()}] Starting LOGIN for user: ${credentials.userId}`);
            console.log(`[${this.getName()}] ========================================`);

            // Authenticate and navigate to attendance dashboard
            await this.authenticateAndNavigate(credentials);

            // Parse today's punch data
            console.log(`[${this.getName()}] Parsing today's punch data...`);
            const punchData = await this.parseTodaysPunches(this.page!);

            // Check if already logged in
            if (this.isPunchedIn(punchData.inTime)) {
                console.log(`[${this.getName()}] Already logged in today - In time: ${punchData.inTime}`);
                return {
                    success: true,
                    message: `Already logged in today at ${punchData.inTime}`,
                    timestamp: new Date(),
                    actualInTime: punchData.inTime
                };
            }

            console.log(`[${this.getName()}] Not logged in yet - In time is: "${punchData.inTime}"`);

            // Execute check-in action
            await this.executeCheckAction();

            // Verify success
            const verified = await this.verifyPunchSuccess('login');

            if (verified) {
                // Re-parse to get the actual time that was just punched
                const updatedPunchData = await this.parseTodaysPunches(this.page!);
                console.log(`[${this.getName()}] ✅ LOGIN SUCCESSFUL`);
                return {
                    success: true,
                    message: 'Login successful - attendance marked',
                    timestamp: new Date(),
                    actualInTime: updatedPunchData.inTime
                };
            } else {
                console.log(`[${this.getName()}] ❌ LOGIN VERIFICATION FAILED`);
                return {
                    success: false,
                    message: 'Login action completed but verification failed - In time not updated',
                    timestamp: new Date()
                };
            }

        } catch (error) {
            console.error(`[${this.getName()}] ❌ Login error:`, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error occurred during login',
                timestamp: new Date()
            };
        } finally {
            // Clean up browser after action
            await this.cleanup();
        }
    }

    /**
     * Execute logout and attendance check-out for Akrivia HCM
     * 
     * Complete implementation following the AKRIVIA_IMPLEMENTATION.md guide:
     * 1. Navigate to login page and authenticate
     * 2. Navigate to attendance dashboard
     * 3. Parse today's punch data
     * 4. Check if already logged out
     * 5. If not logged out, execute check-out action
     * 6. Verify success
     * 
     * @param {LoginCredentials} credentials - User credentials
     * @returns {Promise<LogoutResult>} Result of logout attempt
     */
    async logout(credentials: LoginCredentials): Promise<LogoutResult> {
        try {
            // Initialize browser if not already done
            if (!this.page) {
                await this.initialize();
            }

            console.log(`[${this.getName()}] ========================================`);
            console.log(`[${this.getName()}] Starting LOGOUT for user: ${credentials.userId}`);
            console.log(`[${this.getName()}] ========================================`);

            // Authenticate and navigate to attendance dashboard
            await this.authenticateAndNavigate(credentials);

            // Parse today's punch data
            console.log(`[${this.getName()}] Parsing today's punch data...`);
            const punchData = await this.parseTodaysPunches(this.page!);

            // Check if already logged out
            if (this.isPunchedOut(punchData.outTime)) {
                console.log(`[${this.getName()}] Already logged out today - Out time: ${punchData.outTime}`);
                return {
                    success: true,
                    message: `Already logged out today at ${punchData.outTime}`,
                    timestamp: new Date(),
                    actualOutTime: punchData.outTime
                };
            }

            console.log(`[${this.getName()}] Not logged out yet - Out time is: "${punchData.outTime}"`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Execute check-out action
            await this.executeCheckAction();

            // Verify success
            const verified = await this.verifyPunchSuccess('logout');

            if (verified) {
                // Re-parse to get the actual time that was just punched
                const updatedPunchData = await this.parseTodaysPunches(this.page!);
                console.log(`[${this.getName()}] ✅ LOGOUT SUCCESSFUL`);
                return {
                    success: true,
                    message: 'Logout successful - attendance marked',
                    timestamp: new Date(),
                    actualOutTime: updatedPunchData.outTime
                };
            } else {
                console.log(`[${this.getName()}] ❌ LOGOUT VERIFICATION FAILED`);
                return {
                    success: false,
                    message: 'Logout action completed but verification failed - Out time not updated',
                    timestamp: new Date()
                };
            }

        } catch (error) {
            console.error(`[${this.getName()}] ❌ Logout error:`, error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error occurred during logout',
                timestamp: new Date()
            };
        } finally {
            // Clean up browser after action
            await this.cleanup();
        }
    }
}