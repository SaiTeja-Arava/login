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
 * @see AKRIVIA_IMPLEMENTATION.md for detailed flow documentation
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

export class AkriviaProvider extends BaseAttendanceProvider {
    // Selectors for Akrivia HCM
    private readonly SELECTORS = {
        // Login page
        empIdInput: '#emp_id',
        passwordInput: '#password',
        loginButton: '#login',

        // Dashboard navigation
        attendanceMenu: '#sidenav-attendance_management > div',
        submenu: '#ah-sidenav-sub',
        dashboardLink: '/html/body/app-root/app-dashboard/app-user-dashboard-v4/div[1]/app-common-sidemenu/div/div[2]/ul/li[1]/a',

        // Attendance page
        punchCard: 'body > app-root > app-user-attendance-dashboard > div.ah-page-wrapper > div > div > div.col-md-7.col-xl-8 > div:nth-child(1) > div.ah-card-body.ah-hs-dash-card-body.ng-star-inserted',
        checkInButton: '#check-in',
        modalContainer: '#checkinRequest > div > div',
        confirmButton: '#request-cancel'
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

    /**
     * Parse today's punch in/out times from the attendance dashboard
     * 
     * @param page - Puppeteer page object
     * @returns Promise<PunchData> - Object with inTime and outTime
     */
    private async parseTodaysPunches(page: Page): Promise<PunchData> {
        try {
            // Wait for punch card to load
            await page.waitForSelector(this.SELECTORS.punchCard, { timeout: this.config.timeoutMs });

            console.log(`[${this.getName()}] Parsing today's punches from punch card...`);

            // Extract HTML content
            const cardHtml = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element ? element.innerHTML : '';
            }, this.SELECTORS.punchCard);

            if (!cardHtml) {
                throw new Error('Punch card HTML not found');
            }

            // Parse the HTML to find today's section
            // Look for "Today, November 16, 2025" or similar
            const today = new Date();
            const monthNames = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
            const todayPattern = `Today, ${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

            console.log(`[${this.getName()}] Looking for date pattern: ${todayPattern}`);

            // Extract punch times using DOM manipulation in page context
            const punchData = await page.evaluate((punchCardSelector) => {
                const punchCard = document.querySelector(punchCardSelector);
                if (!punchCard) {
                    console.log(`[${this.getName()}] Punch card element not found during evaluation`);
                    throw new Error('Punch card element not found during evaluation');
                }

                // Find all shift data sections
                const shiftDataElements = punchCard.querySelectorAll('.ah-shift-data');

                // Get the first one (today's data)
                const todaySection = shiftDataElements[0];
                if (!todaySection) {
                    console.log(`[${this.getName()}] Today's shift data section not found`);
                    throw new Error("Today's shift data section not found");
                }

                // Find all shift content sets (In time and Out time)
                const contentSets = todaySection.querySelectorAll('.ah-shift-content-set');

                let inTime = '—';
                let outTime = '—';

                // First set is In time
                if (contentSets[0]) {
                    const inTimeEl = contentSets[0].querySelector('.ah-time .val-text');
                    if (inTimeEl) {
                        inTime = inTimeEl.textContent?.trim() || '—';
                    }
                }

                // Second set is Out time
                if (contentSets[1]) {
                    const outTimeEl = contentSets[1].querySelector('.ah-time .val-text');
                    if (outTimeEl) {
                        outTime = outTimeEl.textContent?.trim() || '—';
                    }
                }

                return { inTime, outTime };
            }, this.SELECTORS.punchCard);

            console.log(`[${this.getName()}] Parsed punch data - In: "${punchData.inTime}", Out: "${punchData.outTime}"`);

            return punchData;

        } catch (error) {
            console.error(`[${this.getName()}] Error parsing punches:`, error);
            throw error;
        }
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
     * Wait for element with retry logic
     * 
     * @param page - Puppeteer page
     * @param selector - CSS selector to wait for
     * @param maxWaitMs - Maximum time to wait
     * @param retryDelayMs - Delay between retries
     * @returns Promise<boolean> - true if found, false if timeout
     */
    private async waitForElementWithRetry(
        page: Page,
        selector: string,
        maxWaitMs: number,
        retryDelayMs: number
    ): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            try {
                const element = await page.$(selector);
                if (element) {
                    return true;
                }
            } catch (error) {
                // Element not found, continue
            }

            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }

        return false;
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

        // Phase 3: Click login button
        console.log(`[${this.getName()}] Clicking login button...`);
        await this.page!.click(this.SELECTORS.loginButton)

        // Phase 4: Wait for dashboard redirect
        console.log(`[${this.getName()}] Waiting for dashboard redirect...`);
        await this.page!.waitForNavigation({
            waitUntil: 'networkidle0',
            timeout: this.config.timeoutMs
        });

        // Verify we're on the dashboard
        const currentUrl = this.page!.url();
        if (!currentUrl.includes('dashboard')) {
            throw new Error('Failed to navigate to dashboard - login may have failed');
        }

        // Phase 5: Navigate to Attendance Dashboard
        console.log(`[${this.getName()}] Navigating to attendance dashboard...`);

        // Click Attendance Management menu
        await this.page!.waitForSelector(this.SELECTORS.attendanceMenu, { timeout: this.config.timeoutMs });
        await this.page!.click(this.SELECTORS.attendanceMenu);

        // Wait for submenu to expand
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Click Dashboard link using XPath
        const dashboardLinks = await this.page!.$x(this.SELECTORS.dashboardLink);
        if (dashboardLinks.length === 0) {
            throw new Error('Dashboard link not found in submenu');
        }
        // @ts-ignore - Puppeteer XPath elements are clickable
        await dashboardLinks[0].click();

        // Wait for attendance page to load
        await this.page!.waitForNavigation({
            waitUntil: 'networkidle0',
            timeout: this.config.timeoutMs
        });

        // Verify we're on attendance dashboard
        const attendanceUrl = this.page!.url();
        if (!attendanceUrl.includes('attendance-dashboard')) {
            throw new Error('Failed to navigate to attendance dashboard');
        }

        console.log(`[${this.getName()}] Successfully authenticated and navigated to attendance dashboard`);
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    /**
     * Execute check-in or check-out action
     * 
     * @returns Promise<void>
     */
    private async executeCheckAction(): Promise<void> {
        // Click Check In button
        console.log(`[${this.getName()}] Clicking Check In button...`);
        await this.page!.waitForSelector(this.SELECTORS.checkInButton, { timeout: this.config.timeoutMs });
        await this.page!.click(this.SELECTORS.checkInButton);

        // Wait for modal to appear
        console.log(`[${this.getName()}] Waiting for confirmation modal...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify modal is visible
        const modalVisible = await this.page!.$(this.SELECTORS.modalContainer);
        if (!modalVisible) {
            throw new Error('Confirmation modal did not appear');
        }

        // Click Confirm button
        console.log(`[${this.getName()}] Clicking Confirm button...`);
        await this.page!.waitForSelector(this.SELECTORS.confirmButton, { timeout: this.config.timeoutMs });
        await this.page!.click(this.SELECTORS.confirmButton);

        // Wait for modal to close
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    /**
     * Verify punch action success by refreshing and checking punch data
     * 
     * @param checkType - 'login' or 'logout'
     * @returns Promise<boolean> - true if verified, false otherwise
     */
    private async verifyPunchSuccess(checkType: 'login' | 'logout'): Promise<boolean> {
        // Refresh the page
        console.log(`[${this.getName()}] Refreshing page to verify ${checkType}...`);
        await this.page!.reload({ waitUntil: 'networkidle0', timeout: this.config.timeoutMs });

        // Retry loop: max 30s, check every 5s (6 attempts)
        const maxRetries = 6;
        const retryDelay = 5000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`[${this.getName()}] Verification attempt ${attempt}/${maxRetries}...`);

            // Wait before checking
            await new Promise(resolve => setTimeout(resolve, retryDelay));

            // Try to find punch card
            const elementFound = await this.waitForElementWithRetry(
                this.page!,
                this.SELECTORS.punchCard,
                5000,
                1000
            );

            if (!elementFound) {
                console.log(`[${this.getName()}] Punch card not found, retrying...`);
                continue;
            }

            // Parse punch data
            const punchData = await this.parseTodaysPunches(this.page!);

            // Check if the appropriate field is updated
            if (checkType === 'login') {
                if (this.isPunchedIn(punchData.inTime)) {
                    console.log(`[${this.getName()}] Login verified - In time: ${punchData.inTime}`);
                    return true;
                }
            } else {
                if (this.isPunchedOut(punchData.outTime)) {
                    console.log(`[${this.getName()}] Logout verified - Out time: ${punchData.outTime}`);
                    return true;
                }
            }

            console.log(`[${this.getName()}] ${checkType} not verified yet, retrying...`);
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