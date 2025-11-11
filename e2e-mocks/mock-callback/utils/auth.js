const db = require('../mock_data');

/**
 * Extract user ID from Authorization header
 * Handles both regular Bearer tokens (userId) and CLI access keys (cli-accessKeyName)
 */
function getUserId(req) {
  // Handle Authorization header first
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  
  if (token) {
    // Handle access key authentication (cli- prefix)
    if (token.startsWith('cli-')) {
      const accessKeyName = token.replace('cli-', '');
      try {
        const account = db.getUserFromAccessKey(accessKeyName);
        if (account && account.id) {
          return account.id;
        }
      } catch (error) {
        return null;
      }
    }
    
    // Regular Bearer token (treat as userId)
    return token || null;
  }
  
  return null;
}

module.exports = {
  getUserId
};

