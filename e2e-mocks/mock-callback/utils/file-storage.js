const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Storage directory - will be created in the container
const STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/codepush-packages';

/**
 * Ensure storage directory exists
 */
function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Generate a unique filename for a package
 * Format: {timestamp}-{random}.zip
 */
function generateFileName() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.zip`;
}

/**
 * Save uploaded file to storage
 * @param {Buffer|Stream} fileData - The file data to save
 * @param {string} originalName - Original filename
 * @returns {Promise<{filePath: string, fileName: string, size: number, hash: string}>}
 */
async function saveFile(fileData, originalName = null) {
  ensureStorageDir();
  
  const fileName = generateFileName();
  const filePath = path.join(STORAGE_DIR, fileName);
  
  // Handle both Buffer and Stream
  if (Buffer.isBuffer(fileData)) {
    fs.writeFileSync(filePath, fileData);
  } else {
    // If it's a stream, write it to file
    const writeStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      fileData.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }
  
  // Get file stats
  const stats = fs.statSync(filePath);
  const size = stats.size;
  
  // Compute SHA256 hash of the file
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  return {
    filePath,
    fileName,
    size,
    hash
  };
}

/**
 * Get file path by filename
 * @param {string} fileName - The filename
 * @returns {string|null} - Full path if file exists, null otherwise
 */
function getFilePath(fileName) {
  const filePath = path.join(STORAGE_DIR, fileName);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

/**
 * Delete a file from storage
 * @param {string} fileName - The filename to delete
 * @returns {boolean} - True if deleted, false if not found
 */
function deleteFile(fileName) {
  const filePath = path.join(STORAGE_DIR, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Generate a download URL for a file
 * This will be used in the blobUrl field
 * @param {string} fileName - The filename
 * @returns {string} - Download URL
 */
function getDownloadUrl(fileName) {
  // Return a path that can be served by our file serving route
  return `/packages/${fileName}`;
}

// Initialize storage directory on module load
ensureStorageDir();

module.exports = {
  saveFile,
  getFilePath,
  deleteFile,
  getDownloadUrl,
  STORAGE_DIR
};

