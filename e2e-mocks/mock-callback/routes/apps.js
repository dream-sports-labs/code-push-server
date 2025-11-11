const db = require('../mock_data');
const { json, html, fieldErr, sendError } = require('../utils/response');

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

// Helper: Validate app name
function isValidAppName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 100;
}

// GET /apps - Get all apps for account
function getApps(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = getTenantId(req);
  const apps = db.getApps(accountId, tenantId);

  // Get deployments for each app and include role/permission
  const appsWithDeployments = apps.map(app => {
    const appDeployments = db.getDeployments(app.id);
    const deploymentNames = appDeployments.map(d => d.name);
    
    // Get user's permission for this app (Owner or Collaborator)
    const collab = db.getCollaboratorForApp(accountId, app.id);
    const role = collab?.permission || 'Admin';
    const isAdmin = collab?.permission === 'Owner';
    
    return {
      id: app.id,
      name: app.name,
      displayName: app.name,
      deployments: deploymentNames,
      createdTime: app.createdTime,
      tenantId: app.tenantId || null,
      role: role, // Add role field
      isAdmin: isAdmin, // Add isAdmin field (used for delete menu visibility)
    };
  });

  // Sort by name
  appsWithDeployments.sort((a, b) => a.name.localeCompare(b.name));

  return res.status(200).json({ apps: appsWithDeployments });
}

// POST /apps - Create a new app
function postApps(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const account = db.getAccount(accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const appRequest = req.body;
  
  // Validation: name is required
  if (!appRequest || !isValidAppName(appRequest.name)) {
    return res.status(400).json([{ field: 'name', message: 'App name is required and must be a valid string' }]);
  }

  // Check for duplicate app name
  if (db.isDuplicateApp(accountId, appRequest)) {
    return res.status(409).json({ error: `An app named '${appRequest.name}' already exists.` });
  }

  // Handle tenant creation if tenantId is provided
  let tenantId = appRequest.tenantId || null;
  
  // If tenantId is provided, ensure tenant exists (create if needed)
  if (tenantId) {
    let tenant = db.getTenant(tenantId);
    if (!tenant) {
      // Create new tenant
      tenant = db.addTenant({
        id: tenantId,
        displayName: appRequest.tenantName || `Organization ${tenantId}`,
        createdBy: accountId
      });
    }
    tenantId = tenant.id;
  }

  // Create app
  const newApp = db.addApp({
    name: appRequest.name.trim(),
    accountId: accountId,
    tenantId: tenantId
  });

  // Add owner as collaborator
  db.addCollaborator({
    email: account.email,
    accountId: accountId,
    appId: newApp.id,
    permission: 'Owner'
  });

  // Create default deployments if not manually provisioned
  let deploymentNames = [];
  if (!appRequest.manuallyProvisionDeployments) {
    const defaultDeployments = ['Production', 'Staging'];
    defaultDeployments.forEach(deploymentName => {
      const deployment = db.addDeployment({
        appId: newApp.id,
        name: deploymentName
      });
      deploymentNames.push(deployment.name);
    });
  }

  // Set Location header
  res.setHeader('Location', `/apps/${newApp.name}`);

  return res.status(201).json({
    app: {
      id: newApp.id,
      name: newApp.name,
      displayName: newApp.name,
      deployments: deploymentNames,
      createdTime: newApp.createdTime,
      tenantId: newApp.tenantId || null
    }
  });
}

// GET /apps/:appName - Get a specific app
function getApp(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const tenantId = getTenantId(req);
  
  const app = db.getAppByName(accountId, appName, tenantId);
  if (!app) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Check access
  if (!hasAccess(accountId, app.id)) {
    return res.status(403).json({ error: 'You do not have access to this app' });
  }

  const appDeployments = db.getDeployments(app.id);
  const deploymentNames = appDeployments.map(d => d.name);

  return res.status(200).json({
    app: {
      id: app.id,
      name: app.name,
      displayName: app.name,
      deployments: deploymentNames,
      createdTime: app.createdTime,
      tenantId: app.tenantId || null
    }
  });
}

// DELETE /apps/:appName - Delete an app
function deleteApp(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const tenantId = getTenantId(req);
  
  const app = db.getAppByName(accountId, appName, tenantId);
  if (!app) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Check if user is owner
  if (!isOwner(accountId, app.id)) {
    return res.status(403).json({ error: 'This action requires Owner permissions on the app!' });
  }

  // Delete app (and associated deployments/collaborators)
  db.deleteApp(accountId, app.id);

  return res.status(201).send('App deleted successfully');
}

// PATCH /apps/:appName - Update an app (change name)
function patchApp(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const appName = req.params.appName;
  const tenantId = getTenantId(req);
  const appRequest = req.body;

  // Get existing app
  const existingApp = db.getAppByName(accountId, appName, tenantId);
  if (!existingApp) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Check if user is owner
  if (!isOwner(accountId, existingApp.id)) {
    return res.status(403).json({ error: 'This action requires Owner permissions on the app!' });
  }

  // If name is being changed
  if (appRequest.name !== undefined && appRequest.name !== existingApp.name) {
    // Validate new name
    if (!isValidAppName(appRequest.name)) {
      return res.status(400).json([{ field: 'name', message: 'App name is required and must be a valid string' }]);
    }

    // Check for duplicate name
    const userApps = db.getApps(accountId);
    const duplicateApp = userApps.find(app => app.name === appRequest.name && app.id !== existingApp.id);
    if (duplicateApp) {
      return res.status(409).json({ error: `An app named '${appRequest.name}' already exists.` });
    }

    // Update app name
    db.updateApp(accountId, existingApp.id, { name: appRequest.name.trim() });
  }

  // Get deployments for response
  const appDeployments = db.getDeployments(existingApp.id);
  const deploymentNames = appDeployments.map(d => d.name);

  // Get updated app
  const updatedApp = db.getAppByName(accountId, appRequest.name || appName, tenantId);

  return res.status(200).json({
    app: {
      id: updatedApp.id,
      name: updatedApp.name,
      displayName: updatedApp.name,
      deployments: deploymentNames,
      createdTime: updatedApp.createdTime,
      tenantId: updatedApp.tenantId || null
    }
  });
}

module.exports = {
  getApps,
  postApps,
  getApp,
  deleteApp,
  patchApp
};

