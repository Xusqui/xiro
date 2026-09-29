/**
 * @fileoverview Password hashing helpers using Node scrypt
 * @module services/auth/password-hasher
 */

const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);
const HASH_PREFIX = 'scrypt';
const HASH_LENGTH = 64;

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = await scryptAsync(String(password), salt, HASH_LENGTH);
    return `${HASH_PREFIX}$${salt}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
    const [prefix, salt, hashHex] = String(storedHash || '').split('$');

    if (prefix !== HASH_PREFIX || !salt || !hashHex) {
        return false;
    }

    const expectedHash = Buffer.from(hashHex, 'hex');
    const derived = await scryptAsync(String(password), salt, expectedHash.length);
    const derivedBuffer = Buffer.from(derived);

    if (expectedHash.length !== derivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedHash, derivedBuffer);
}

module.exports = {
    hashPassword,
    verifyPassword
};
