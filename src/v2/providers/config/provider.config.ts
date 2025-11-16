/**
 * Provider Configuration
 * 
 * Centralized configuration for all attendance automation providers.
 * Each provider has specific settings like URLs, timeouts, and behavior.
 */

import { ProviderConfig } from '../base/provider.interface';

/**
 * Akrivia HCM Provider Configuration
 * 
 * Keus platform - Akrivia HCM attendance system
 */
export const AKRIVIA_CONFIG: ProviderConfig = {
    name: 'Akrivia HCM',
    loginUrl: 'https://keus.akriviahcm.com/login?returnUrl=%2Fdashboard%2Fdashboard',
    timeoutMs: 30000, // 30 seconds timeout for page loads
    // headless: true,   // Set to false for debugging
    headless: false,   // Set to false for debugging
    retryAttempts: 3
};

export const enum ProviderType {
    AKRIVIA = 'akrivia'
}

/**
 * Export all provider configs
 * Add more providers here as needed
 */
export const PROVIDER_CONFIGS = {
    [ProviderType.AKRIVIA]: AKRIVIA_CONFIG
};
