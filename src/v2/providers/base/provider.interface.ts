/**
 * Provider Interface
 * 
 * Base interfaces and types for attendance automation providers.
 * All provider implementations must conform to these interfaces.
 */

/**
 * Login credentials for authentication
 */
export interface LoginCredentials {
    userId: string;
    password: string;
}

/**
 * Result returned after a login attempt
 */
export interface LoginResult {
    success: boolean;
    message?: string;
    timestamp: Date;
}

/**
 * Result returned after a logout attempt
 */
export interface LogoutResult {
    success: boolean;
    message?: string;
    timestamp: Date;
}

/**
 * Configuration for a provider
 */
export interface ProviderConfig {
    name: string;
    loginUrl: string;
    timeoutMs: number;
    headless: boolean;
    retryAttempts?: number;
}

/**
 * Base interface that all attendance providers must implement
 * 
 * This ensures consistent behavior across different attendance systems
 * (Akrivia, GreyHR, etc.)
 */
export interface IAttendanceProvider {
    /**
     * Get the name of the provider
     * @returns {string} Provider name (e.g., "Akrivia HCM")
     */
    getName(): string;

    /**
     * Initialize the provider
     * This typically launches a browser instance and prepares for automation
     * @returns {Promise<void>}
     */
    initialize(): Promise<void>;

    /**
     * Execute login/attendance sign-in action
     * @param {LoginCredentials} credentials - User credentials
     * @returns {Promise<LoginResult>} Result of the login attempt
     */
    login(credentials: LoginCredentials): Promise<LoginResult>;

    /**
     * Execute logout/attendance sign-out action
     * @param {LoginCredentials} credentials - User credentials
     * @returns {Promise<LogoutResult>} Result of the logout attempt
     */
    logout(credentials: LoginCredentials): Promise<LogoutResult>;

    /**
     * Cleanup resources (close browser, etc.)
     * @returns {Promise<void>}
     */
    cleanup(): Promise<void>;

    /**
     * Check if the provider is healthy and reachable
     * @returns {Promise<boolean>} True if healthy, false otherwise
     */
    healthCheck(): Promise<boolean>;
}
