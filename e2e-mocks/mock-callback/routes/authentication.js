const db = require('../mock_data');

// Helper: Extract user ID from Authorization header
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
        return account ? account.id : null;
      } catch (error) {
        return null;
      }
    }
    
    // Regular Bearer token (treat as userId)
    return token || null;
  }
  
  // If no Authorization header, check userId header (alternative auth method)
  // Express lowercases headers, but MockServer might forward as-is
  const userId = Array.isArray(req.headers.userid) ? req.headers.userid[0] : 
                 Array.isArray(req.headers.userId) ? req.headers.userId[0] : 
                 req.headers.userid || req.headers.userId;
  
  if (userId) {
    const account = db.getAccount(userId);
    return account ? userId : null;
  }
  
  return null;
}

// GET /authenticated - Check if user is authenticated
function getAuthenticated(req, res) {
  // Debug: log headers (commented out for production)
  // console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  const accountId = getUserId(req);
  
  if (!accountId) {
    return res.status(401).send('Authentication failed');
  }
  
  const account = db.getAccount(accountId);
  if (!account) {
    return res.status(401).send('User not found');
  }
  
  return res.status(200).json({
    authenticated: true,
    user: {
      id: account.id,
      email: account.email,
      name: account.name
    }
  });
}

module.exports = {
  getAuthenticated
};

