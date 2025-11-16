/**
 * Provider Factory
 * 
 * Creates and manages provider instances.
 * This is where you configure which provider to use.
 */

import { IAttendanceProvider } from './base/provider.interface';
import { AkriviaProvider } from './implementations/akrivia.provider';
import { DEFAULT_PROVIDER } from '../config/constants';
import { ProviderType } from './config/provider.config';

// Singleton instance
let providerInstance: IAttendanceProvider | null = null;

/**
 * Get the configured attendance provider instance
 * 
 * @returns {IAttendanceProvider} The active provider instance
 */
export function getAttendanceProvider(): IAttendanceProvider {
    if (!providerInstance) {
        // This is where you change providers
        // Simply replace with: new SomeOtherProvider() when needed
        providerInstance = createProvider(DEFAULT_PROVIDER);
    }
    return providerInstance;
}

/**
 * Create a provider instance based on provider type
 * 
 * @param {string} providerType - Provider type ('akrivia', etc.)
 * @returns {IAttendanceProvider} Provider instance
 */
function createProvider(providerType: ProviderType): IAttendanceProvider {
    switch (providerType.toLowerCase()) {
        case ProviderType.AKRIVIA:
            return new AkriviaProvider();

        // Add more providers here as needed:
        // case 'greythr':
        //     return new GreyHRProvider();

        default:
            throw new Error(`Unsupported provider type: ${providerType}`);
    }
}

/**
 * Reset provider instance (useful for testing or switching providers)
 */
export function resetProvider(): void {
    providerInstance = null;
}
