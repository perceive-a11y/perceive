/**
 * AES-256-GCM encryption/decryption for sensitive data (e.g. store passwords).
 *
 * Requires DEEP_SCAN_KEY env var — a 64-character hex string (32 bytes).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Read the encryption key from the environment.
 *
 * # Returns
 *
 * 32-byte Buffer derived from the hex-encoded DEEP_SCAN_KEY env var.
 *
 * # Errors
 *
 * Throws if DEEP_SCAN_KEY is missing or not a valid 64-char hex string.
 */
function getKey(): Buffer {
    const hex = process.env.DEEP_SCAN_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error(
            "DEEP_SCAN_KEY must be a 64-character hex string (32 bytes). " +
            "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }
    return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 *
 * # Arguments
 *
 * * `plaintext` - The string to encrypt
 *
 * # Returns
 *
 * Hex-encoded string in the format: iv:ciphertext:authTag
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    // Pack as iv:ciphertext:tag — all hex-encoded
    return `${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 *
 * # Arguments
 *
 * * `packed` - Hex-encoded string in the format iv:ciphertext:authTag
 *
 * # Returns
 *
 * The original plaintext string.
 *
 * # Errors
 *
 * Throws if the auth tag is invalid (tampered data) or format is wrong.
 */
export function decrypt(packed: string): string {
    const key = getKey();
    const parts = packed.split(":");
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const ciphertext = parts[1];
    const tag = Buffer.from(parts[2], "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
