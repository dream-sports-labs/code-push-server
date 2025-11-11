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

// Helper: Validate deployment name (matches validation.ts logic)
function isValidNameField(name) {
  if (typeof name !== 'string') return false;
  // Name must be 1-1000 characters, no URL special chars, no control chars, no colon
  if (name.length === 0 || name.length > 1000) return false;
  if (/[\\\/\?]/.test(name)) return false; // No URL special chars
  if (/[\x00-\x1F]/.test(name)) return false; // No control chars
  if (/[\x7F-\x9F]/.test(name)) return false; // No extended control chars
  if (/:/.test(name)) return false; // No colon (used as delimiter)
  return true;
}

// Helper: Validate deployment key (if provided)
function isValidKeyField(key) {
  if (!key) return true; // Key is optional
  if (typeof key !== 'string') return false;
  return key.length > 0 && key.length <= 1000;
}

// Helper: Generate secure key (simplified version)
function generateSecureKey(prefix) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-';
  let result = prefix + '-';
  for (let i = 0; i < 43; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Find deployment by name
function findDeploymentByName(deployments, name) {
  return deployments.find(d => d.name === name);
}

// Helper: Check for duplicate deployment name
function isDuplicateDeployment(deployments, name) {
  return deployments.some(d => d.name === name);
}

// GET /apps/:appName/deployments - Get all deployments for an app
function getDeployments(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const tenantId = getTenantId(req);

  // Check if app exists
  const appExists = db.appExists(appName, tenantId);
  if (!appExists) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Get app
  const app = db.getAppByName(accountId, appName, tenantId);

  // If app exists but user doesn't have access, return 403
  if (!app) {
    return res.status(403).json({ error: 'This action requires Collaborator permissions on the app!' });
  }

  // Get deployments for the app
  const deployments = db.getDeployments(app.id);
  
  // Format deployments (remove internal fields, add package/packageHistory)
  const restDeployments = deployments.map(deployment => ({
    name: deployment.name,
    key: deployment.key,
    package: deployment.package || null,
    packageHistory: deployment.packageHistory || []
  }));
  
  // Sort deployments by name
  restDeployments.sort((first, second) => {
    return first.name.localeCompare(second.name);
  });

  return res.status(200).json({ deployments: restDeployments });
}

// POST /apps/:appName/deployments - Create a new deployment
function postDeployment(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const tenantId = getTenantId(req);
  const deploymentRequest = req.body;

  // Validation: name is required
  if (!deploymentRequest || !deploymentRequest.name) {
    return res.status(400).json([{ field: 'name', message: 'Field is required' }]);
  }

  // Validate name field
  if (!isValidNameField(deploymentRequest.name)) {
    return res.status(400).json([{ field: 'name', message: 'Field is invalid' }]);
  }

  // Validate key field (if provided)
  if (deploymentRequest.key && !isValidKeyField(deploymentRequest.key)) {
    return res.status(400).json([{ field: 'key', message: 'Field is invalid' }]);
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

  // Check for duplicate deployment name
  const existingDeployments = db.getDeployments(app.id);
  if (isDuplicateDeployment(existingDeployments, deploymentRequest.name)) {
    return res.status(409).json({ error: `A deployment named '${deploymentRequest.name}' already exists.` });
  }

  // Create deployment
  const deploymentData = {
    name: deploymentRequest.name.trim(),
    appId: app.id,
    key: deploymentRequest.key || generateSecureKey(accountId)
  };

  const newDeployment = db.addDeployment(deploymentData);

  // Format response (remove internal fields, add package/packageHistory)
  const restDeployment = {
    name: newDeployment.name,
    key: newDeployment.key,
    package: null,
    packageHistory: []
  };

  res.setHeader('Location', `/apps/${appName}/deployments/${restDeployment.name}`);
  return res.status(201).json({ deployment: restDeployment });
}

// GET /apps/:appName/deployments/:deploymentName - Get a specific deployment
function getDeployment(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const deploymentName = req.params.deploymentName;
  const tenantId = getTenantId(req);

  // Check if app exists
  const appExists = db.appExists(appName, tenantId);
  if (!appExists) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Get app
  const app = db.getAppByName(accountId, appName, tenantId);

  // If app exists but user doesn't have access, return 403
  if (!app) {
    return res.status(403).json({ error: 'This action requires Collaborator permissions on the app!' });
  }

  // Get deployments
  const deployments = db.getDeployments(app.id);
  const deployment = findDeploymentByName(deployments, deploymentName);

  if (!deployment) {
    return res.status(404).json({ error: `Deployment "${deploymentName}" does not exist.` });
  }

  // Format response (add package/packageHistory)
  const restDeployment = {
    name: deployment.name,
    key: deployment.key,
    package: deployment.package || null,
    packageHistory: deployment.packageHistory || []
  };

  return res.status(200).json({ deployment: restDeployment });
}

// DELETE /apps/:appName/deployments/:deploymentName - Delete a deployment
function deleteDeployment(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const deploymentName = req.params.deploymentName;
  const tenantId = getTenantId(req);

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

  // Get deployments
  const deployments = db.getDeployments(app.id);
  const deployment = findDeploymentByName(deployments, deploymentName);

  if (!deployment) {
    return res.status(404).json({ error: `Deployment "${deploymentName}" does not exist.` });
  }

  // Delete deployment
  db.deleteDeployment(app.id, deployment.id);

  return res.status(201).send('Deployment deleted successfully');
}

// PATCH /apps/:appName/deployments/:deploymentName - Update a deployment (change name)
function patchDeployment(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const deploymentName = req.params.deploymentName;
  const tenantId = getTenantId(req);
  const deploymentRequest = req.body;

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

  // Get deployments
  const deployments = db.getDeployments(app.id);
  const existingDeployment = findDeploymentByName(deployments, deploymentName);

  if (!existingDeployment) {
    return res.status(404).json({ error: `Deployment "${deploymentName}" does not exist.` });
  }

  // If name is being changed
  if (deploymentRequest.name !== undefined && deploymentRequest.name !== existingDeployment.name) {
    // Validate new name
    if (!isValidNameField(deploymentRequest.name)) {
      return res.status(400).json([{ field: 'name', message: 'Field is invalid' }]);
    }

    // Check for duplicate deployment name
    if (isDuplicateDeployment(deployments, deploymentRequest.name)) {
      return res.status(409).json({ error: `A deployment named '${deploymentRequest.name}' already exists.` });
    }

    // Update deployment name
    db.updateDeployment(app.id, existingDeployment.id, { name: deploymentRequest.name.trim() });
  }

  // Get updated deployment
  const updatedDeployments = db.getDeployments(app.id);
  const updatedDeployment = findDeploymentByName(updatedDeployments, deploymentRequest.name || deploymentName);

  // Format response
  const restDeployment = {
    name: updatedDeployment.name,
    key: updatedDeployment.key,
    package: updatedDeployment.package || null,
    packageHistory: updatedDeployment.packageHistory || []
  };

  return res.status(200).json({ deployment: restDeployment });
}

module.exports = {
  getDeployments,
  postDeployment,
  getDeployment,
  deleteDeployment,
  patchDeployment
};

