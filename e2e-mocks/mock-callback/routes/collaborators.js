const db = require('../mock_data');
const appsRoutes = require('./apps');
const { getUserId } = require('../utils/auth');

// Helper: Extract tenant ID from header
function getTenantId(req) {
  const tenant = req.headers.tenant;
  return Array.isArray(tenant) ? tenant[0] : tenant || null;
}

// Helper: Check if user is owner
function isOwner(accountId, appId) {
  const collab = db.getCollaboratorForApp(accountId, appId);
  return collab && collab.permission === 'Owner';
}

// Helper: Check if user has collaborator access
function hasAccess(accountId, appId) {
  return db.getCollaboratorForApp(accountId, appId) !== undefined;
}

// Helper: Validate email parameter (prototype pollution check)
function isPrototypePollutionKey(key) {
  if (!key || typeof key !== 'string') return false;
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  return dangerousKeys.includes(key.toLowerCase());
}

// GET /apps/:appName/collaborators - Get all collaborators for an app
function getCollaborators(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const tenantId = getTenantId(req);
  
  // Check if app exists (regardless of user access)
  const appExists = db.appExists(appName, tenantId);
  if (!appExists) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Get app (reusing logic from apps routes)
  const app = db.getAppByName(accountId, appName, tenantId);
  
  // If app exists but user doesn't have access, return 403
  if (!app) {
    return res.status(403).json({ error: 'This action requires Collaborator permissions on the app!' });
  }

  // Get collaborators map
  const collaboratorsMap = db.getCollaboratorsMap(accountId, app.id);

  return res.status(200).json({ collaborators: collaboratorsMap });
}

// POST /apps/:appName/collaborators/:email - Add a collaborator to an app
function postCollaborator(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const email = req.params.email;
  const tenantId = getTenantId(req);

  // Validate email parameter
  if (isPrototypePollutionKey(email)) {
    return res.status(400).send('Invalid email parameter');
  }

  // Check if app exists (regardless of user access)
  const appExists = db.appExists(appName, tenantId);
  if (!appExists) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Get app (reusing logic from apps routes)
  const app = db.getAppByName(accountId, appName, tenantId);
  
  // If app exists but user doesn't have access, return 403
  if (!app) {
    return res.status(403).json({ error: 'This action requires Owner permissions on the app!' });
  }

  // Check if user is owner
  if (!isOwner(accountId, app.id)) {
    return res.status(403).json({ error: 'This action requires Owner permissions on the app!' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    db.addCollaboratorToApp(accountId, app.id, email);
    return res.status(201).send();
  } catch (error) {
    if (error.message === 'The specified e-mail address doesn\'t represent a registered user') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'The given account is already a collaborator for this app.') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
}

// DELETE /apps/:appName/collaborators/:email - Remove a collaborator from an app
function deleteCollaborator(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const email = req.params.email;
  const tenantId = getTenantId(req);

  // Validate email parameter
  if (isPrototypePollutionKey(email)) {
    return res.status(400).send('Invalid email parameter');
  }

  // Check if app exists (regardless of user access)
  const appExists = db.appExists(appName, tenantId);
  if (!appExists) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Get app (reusing logic from apps routes)
  const app = db.getAppByName(accountId, appName, tenantId);
  
  // If app exists but user doesn't have access, return 403
  if (!app) {
    return res.status(403).json({ error: 'This action requires Collaborator permissions on the app!' });
  }

  // Check if user is attempting to remove themselves
  const currentCollab = db.getCollaboratorForApp(accountId, app.id);
  const isRemovingSelf = currentCollab && 
    (currentCollab.email === email || currentCollab.email.toLowerCase() === email.toLowerCase());

  // Permission check: Owner can remove anyone, Collaborator can only remove themselves
  if (isRemovingSelf) {
    // Collaborator can remove themselves
    if (!hasAccess(accountId, app.id)) {
      return res.status(403).json({ error: 'This action requires Collaborator permissions on the app!' });
    }
  } else {
    // Owner required to remove others
    if (!isOwner(accountId, app.id)) {
      return res.status(403).json({ error: 'This action requires Owner permissions on the app!' });
    }
  }

  try {
    db.removeCollaboratorFromApp(accountId, app.id, email);
    return res.status(201).send('Collaborator removed successfully');
  } catch (error) {
    if (error.message === 'The given email is not a collaborator for this app.') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Cannot remove the owner of the app from collaborator list.') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
}

// PATCH /apps/:appName/collaborators/:email - Change collaborator role
function patchCollaborator(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const email = req.params.email;
  const tenantId = getTenantId(req);
  const role = req.body.role || 'Collaborator'; // Default to Collaborator if not specified

  // Validate email parameter
  if (isPrototypePollutionKey(email)) {
    return res.status(400).send('Invalid email parameter');
  }

  // Validate role
  if (role !== 'Owner' && role !== 'Collaborator') {
    return res.status(400).json({ error: 'Invalid role. Must be "Owner" or "Collaborator"' });
  }

  // Check if app exists
  const appExists = db.appExists(appName, tenantId);
  if (!appExists) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Get app
  const app = db.getAppByName(accountId, appName, tenantId);
  
  // If app exists but user doesn't have access, return 403
  if (!app) {
    return res.status(403).json({ error: 'This action requires Owner permissions on the app!' });
  }

  // Check if user is owner
  if (!isOwner(accountId, app.id)) {
    return res.status(403).json({ error: 'This action requires Owner permissions on the app!' });
  }

  // Check if collaborator exists and get their info
  const collaboratorsMap = db.getCollaboratorsMap(accountId, app.id);
  const collaboratorBeingModified = collaboratorsMap[email] || 
    Object.values(collaboratorsMap).find(c => c.email && c.email.toLowerCase() === email.toLowerCase());

  // Find by email in collaborators array
  const collabInDb = db.getCollaborators(app.id).find(c => 
    c.email === email || c.email.toLowerCase() === email.toLowerCase()
  );

  if (!collabInDb) {
    return res.status(404).json({ error: 'The given email is not a collaborator for this app.' });
  }

  // Prevent ONLY the app creator from changing their permission from Owner to Collaborator
  const appCreatorAccountId = app.accountId;
  const collaboratorAccountId = collabInDb.accountId;
  
  if (collaboratorAccountId === appCreatorAccountId && role === 'Collaborator') {
    return res.status(409).json({ error: 'The app creator cannot change their permission from Owner to Collaborator.' });
  }

  try {
    // Update collaborator role
    db.updateCollaboratorRole(accountId, app.id, email, role);
    return res.status(200).send();
  } catch (error) {
    if (error.message === 'The given email is not a collaborator for this app.') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getCollaborators,
  postCollaborator,
  deleteCollaborator,
  patchCollaborator
};

