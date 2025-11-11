const db = require('../mock_data');
const { getUserId } = require('../utils/auth');

// Helper: Extract IP address from request
function getIpAddress(req) {
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

// Helper: Generate secure key (simplified)
function generateSecureKey(accountId) {
  // Simple mock implementation - in real code this would be more secure
  return `key-${accountId}-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
}

// Helper: Validate key field (10-100 chars, alphanumeric and some special chars)
function isValidKeyField(val) {
  if (!val || typeof val !== 'string') return false;
  if (val.length < 10 || val.length > 100) return false;
  // Simplified validation - allow alphanumeric and common safe characters
  return /^[a-zA-Z0-9_\-]+$/.test(val);
}

// Helper: Validate friendly name (1-10000 chars)
function isValidFriendlyNameField(val) {
  if (!val || typeof val !== 'string') return false;
  if (val.length < 1 || val.length > 10000) return false;
  return true;
}

// Helper: Validate TTL (>= 0, allow 0 for updates)
function isValidTtlField(allowZero, val) {
  if (val === null || val === undefined) return true; // Optional
  if (typeof val !== 'number' || isNaN(val)) return false;
  return val >= 0 && (val !== 0 || allowZero);
}

// Helper: Validate scope
function isValidScope(val) {
  if (val === null || val === undefined) return true; // Optional
  return ['All', 'Write', 'Read'].includes(val);
}

// Helper: Check if name is duplicate (checks both name and friendlyName)
function isDuplicate(accessKeys, name) {
  return accessKeys.some(ak => ak.name === name || ak.friendlyName === name);
}

// Helper: Find access key by name (checks both name and friendlyName)
function findByName(accessKeys, name) {
  return accessKeys.find(ak => ak.name === name || ak.friendlyName === name);
}

// Default TTL: 60 days in milliseconds
const DEFAULT_ACCESS_KEY_EXPIRY = 1000 * 60 * 60 * 24 * 60;
const ACCESS_KEY_MASKING_STRING = '(hidden)';

// GET /accessKeys - List all access keys for account
function getAccessKeys(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessKeysList = db.getAccessKeys(accountId);

  // Sort by createdTime
  accessKeysList.sort((first, second) => {
    const firstTime = first.createdTime || 0;
    const secondTime = second.createdTime || 0;
    return firstTime - secondTime;
  });

  // Mask the actual key string for legacy CLIs
  const maskedKeys = accessKeysList.map(ak => ({
    ...ak,
    name: ACCESS_KEY_MASKING_STRING
  }));

  return res.status(200).json({ accessKeys: maskedKeys });
}

// POST /accessKeys - Create a new access key
function postAccessKeys(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessKeyRequest = req.body;

  // Generate name if not provided
  if (!accessKeyRequest.name) {
    accessKeyRequest.name = generateSecureKey(accountId);
  }

  // Set createdBy from IP if not provided
  if (!accessKeyRequest.createdBy) {
    accessKeyRequest.createdBy = getIpAddress(req);
  }

  // Validate required fields
  const validationErrors = [];
  
  if (!isValidKeyField(accessKeyRequest.name)) {
    validationErrors.push({ field: 'name', message: 'Field is invalid' });
  }
  
  if (!accessKeyRequest.friendlyName || !isValidFriendlyNameField(accessKeyRequest.friendlyName)) {
    validationErrors.push({ field: 'friendlyName', message: 'Field is required' });
  }
  
  if (accessKeyRequest.ttl !== undefined && !isValidTtlField(false, accessKeyRequest.ttl)) {
    validationErrors.push({ field: 'ttl', message: 'Field is invalid' });
  }
  
  if (!isValidScope(accessKeyRequest.scope)) {
    validationErrors.push({ field: 'scope', message: 'Field is invalid' });
  }

  if (validationErrors.length > 0) {
    return res.status(400).json(validationErrors);
  }

  // Check for duplicates
  const existingKeys = db.getAccessKeys(accountId);
  if (isDuplicate(existingKeys, accessKeyRequest.name)) {
    return res.status(409).json({ error: `The access key "${accessKeyRequest.name}" already exists.` });
  }
  
  if (isDuplicate(existingKeys, accessKeyRequest.friendlyName)) {
    return res.status(409).json({ error: `The access key "${accessKeyRequest.friendlyName}" already exists.` });
  }

  // Create access key
  const createdTime = Date.now();
  const ttl = accessKeyRequest.ttl || DEFAULT_ACCESS_KEY_EXPIRY;
  const expires = createdTime + ttl;

  const accessKey = {
    name: accessKeyRequest.name,
    friendlyName: accessKeyRequest.friendlyName,
    description: accessKeyRequest.friendlyName, // description = friendlyName
    createdTime: createdTime,
    expires: expires,
    createdBy: accessKeyRequest.createdBy,
    scope: accessKeyRequest.scope || 'All',
    isSession: accessKeyRequest.isSession || false
  };

  const accessKeyId = db.addAccessKey(accountId, accessKey);

  // Return access key (without internal id)
  const restAccessKey = {
    ...accessKey,
    id: accessKeyId
  };

  res.setHeader('Location', `/accessKeys/${accessKey.friendlyName}`);
  return res.status(201).json({ accessKey: restAccessKey });
}

// GET /accessKeys/:accessKeyName - Get a specific access key
function getAccessKey(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessKeyName = req.params.accessKeyName;

  const existingKeys = db.getAccessKeys(accountId);
  const accessKey = findByName(existingKeys, accessKeyName);

  if (!accessKey) {
    return res.status(404).json({ error: `Access key "${accessKeyName}" does not exist.` });
  }

  // Delete name from response (security)
  const restAccessKey = { ...accessKey };
  delete restAccessKey.name;

  return res.status(200).json({ accessKey: restAccessKey });
}

// PATCH /accessKeys/:accessKeyName - Update an access key
function patchAccessKey(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessKeyName = req.params.accessKeyName;
  const accessKeyRequest = req.body;

  // Validate fields (all optional for update)
  const validationErrors = [];
  
  if (accessKeyRequest.friendlyName !== undefined && !isValidFriendlyNameField(accessKeyRequest.friendlyName)) {
    validationErrors.push({ field: 'friendlyName', message: 'Field is invalid' });
  }
  
  if (accessKeyRequest.ttl !== undefined && !isValidTtlField(true, accessKeyRequest.ttl)) {
    validationErrors.push({ field: 'ttl', message: 'Field is invalid' });
  }
  
  if (accessKeyRequest.scope !== undefined && !isValidScope(accessKeyRequest.scope)) {
    validationErrors.push({ field: 'scope', message: 'Field is invalid' });
  }

  if (validationErrors.length > 0) {
    return res.status(400).json(validationErrors);
  }

  // Find existing access key
  const existingKeys = db.getAccessKeys(accountId);
  let updatedAccessKey = findByName(existingKeys, accessKeyName);

  if (!updatedAccessKey) {
    return res.status(404).json({ error: `Access key "${accessKeyName}" does not exist.` });
  }

  // Update fields
  if (accessKeyRequest.description !== undefined) {
    updatedAccessKey.description = accessKeyRequest.description;
  }

  if (accessKeyRequest.friendlyName !== undefined) {
    // Check for duplicate friendlyName
    if (isDuplicate(existingKeys, accessKeyRequest.friendlyName) && 
        updatedAccessKey.friendlyName !== accessKeyRequest.friendlyName) {
      return res.status(409).json({ error: `The access key "${accessKeyRequest.friendlyName}" already exists.` });
    }
    
    updatedAccessKey.friendlyName = accessKeyRequest.friendlyName;
    updatedAccessKey.description = accessKeyRequest.friendlyName;
  }

  if (accessKeyRequest.scope !== undefined) {
    updatedAccessKey.scope = accessKeyRequest.scope;
  }

  if (accessKeyRequest.ttl !== undefined) {
    updatedAccessKey.expires = Date.now() + accessKeyRequest.ttl;
  }

  // Save updates
  db.updateAccessKey(accountId, updatedAccessKey);

  // Delete name from response
  const restAccessKey = { ...updatedAccessKey };
  delete restAccessKey.name;

  return res.status(200).json({ accessKey: restAccessKey });
}

// DELETE /accessKeys/:accessKeyName - Delete an access key
function deleteAccessKey(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessKeyName = req.params.accessKeyName;

  const existingKeys = db.getAccessKeys(accountId);
  const accessKey = findByName(existingKeys, accessKeyName);

  if (!accessKey) {
    return res.status(404).json({ error: `Access key "${accessKeyName}" does not exist.` });
  }

  db.removeAccessKey(accountId, accessKey.id);

  return res.status(201).send('Access key deleted successfully');
}

// DELETE /sessions/:createdBy - Delete all sessions with a specific createdBy
function deleteSessions(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const createdBy = req.params.createdBy;

  const removedCount = db.removeAccessKeysByCreatedBy(accountId, createdBy);

  if (removedCount === 0) {
    return res.status(404).json({ error: `There are no sessions associated with "${createdBy}."` });
  }

  return res.status(204).send();
}

// GET /accountByaccessKeyName - Get account by access key name (from header)
function getAccountByAccessKeyName(req, res) {
  const accessKeyName = Array.isArray(req.headers.accesskeyname) 
    ? req.headers.accesskeyname[0] 
    : req.headers.accesskeyname;

  if (!accessKeyName) {
    return res.status(400).send('Access key name is required');
  }

  try {
    const account = db.getUserFromAccessKey(accessKeyName);
    return res.status(200).json({ user: account });
  } catch (error) {
    if (error.message === 'Access key not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'The access key has expired.') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAccessKeys,
  postAccessKeys,
  getAccessKey,
  patchAccessKey,
  deleteAccessKey,
  deleteSessions,
  getAccountByAccessKeyName
};

