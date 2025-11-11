const db = require('../mock_data');
const { json, html, fieldErr, sendError } = require('../utils/response');

const { getUserId } = require('../utils/auth');

// GET /tenants - Get all tenants/organizations for account
function getTenants(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const account = db.getAccount(accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const organisations = db.getTenants(accountId);

  return res.status(200).json({ organisations });
}

// DELETE /tenants/:tenantId - Delete a tenant/organization
function deleteTenant(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tenantId = req.params.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant ID is required' });
  }

  try {
    db.removeTenant(accountId, tenantId);
    return res.status(201).send('Org deleted successfully');
  } catch (error) {
    if (error.message === 'Specified Organisation does not exist.') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'User does not have admin permissions for the specified tenant.') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
}

// POST /api/v1/new/apps - Create a new tenant/organization with an initial app
function createTenant(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const account = db.getAccount(accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const { orgName, name } = req.body;
  if (!orgName) {
    return res.status(400).json({ error: 'orgName is required' });
  }
  if (!name) {
    return res.status(400).json({ error: 'app name is required' });
  }

  try {
    // Create tenant (addTenant generates the ID)
    const newTenant = db.addTenant({
      displayName: orgName,
      createdBy: accountId,
    });

    // Create app under the new tenant
    const newApp = db.addApp({
      name: name.trim(),
      accountId: accountId,
      tenantId: newTenant.id, // Use the ID returned by addTenant
    });

    // Add owner as collaborator
    db.addCollaborator({
      email: account.email,
      accountId: accountId,
      appId: newApp.id,
      permission: 'Owner',
    });

    // Create default deployments
    const deploymentNames = [];
    const defaultDeployments = ['Production', 'Staging'];
    defaultDeployments.forEach((deploymentName) => {
      const deployment = db.addDeployment({
        appId: newApp.id,
        name: deploymentName,
      });
      deploymentNames.push(deployment.name);
    });

    return res.status(201).json({
      app: {
        id: newApp.id,
        name: newApp.name,
        displayName: newApp.name,
        deployments: deploymentNames,
        createdTime: newApp.createdTime,
        tenantId: newApp.tenantId,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Helper function to generate unique IDs
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  getTenants,
  deleteTenant,
  createTenant
};

