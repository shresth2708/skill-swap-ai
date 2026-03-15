const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hashes a plain text string (e.g., password)
 * @param {string} plainText - The text to hash
 * @returns {Promise<string>} - The hashed string
 */
const hashString = async (plainText) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return await bcrypt.hash(plainText, salt);
};

/**
 * Compares a plain text string with a hash
 * @param {string} plainText - The text to verify
 * @param {string} hash - The hash to compare against
 * @returns {Promise<boolean>} - True if they match, false otherwise
 */
const compareHash = async (plainText, hash) => {
  return await bcrypt.compare(plainText, hash);
};

module.exports = {
  hashString,
  compareHash
};
