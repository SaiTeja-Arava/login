import crypto from 'crypto';
import { ENCRYPTION_KEY, SALT } from '../config/constants';

/**
 * Encrypts a password using AES-256-CBC encryption
 * @param password - Plain text password to encrypt
 * @returns Base64 encoded encrypted password
 * @throws Error if encryption fails
 */
export function encrypt(password: string): string {
    try {
        // Derive key from master key and salt
        const key = crypto.scryptSync(ENCRYPTION_KEY, SALT, 32);

        // Generate random initialization vector
        const iv = crypto.randomBytes(16);

        // Create cipher
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

        // Encrypt password
        let encrypted = cipher.update(password, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Combine IV and encrypted data, then encode as base64
        const combined = iv.toString('hex') + ':' + encrypted;
        return Buffer.from(combined).toString('base64');
    } catch (error) {
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Decrypts an encrypted password
 * @param encryptedPassword - Base64 encoded encrypted password
 * @returns Decrypted plain text password
 * @throws Error if decryption fails
 */
export function decrypt(encryptedPassword: string): string {
    try {
        // Decode from base64
        const combined = Buffer.from(encryptedPassword, 'base64').toString('utf8');

        // Split IV and encrypted data
        const parts = combined.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted password format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        // Derive key from master key and salt
        const key = crypto.scryptSync(ENCRYPTION_KEY, SALT, 32);

        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        // Decrypt password
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        console.log('Decrypted password:', decrypted); // Debug log
        return decrypted;
    } catch (error) {
        throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
