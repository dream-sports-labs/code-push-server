const db = require('../mock_data');
const deploymentsRoutes = require('./deployments');
const fileStorage = require('../utils/file-storage');
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

// Helper: Validate app version (semver or range)
function isValidAppVersionRange(version) {
  if (!version || typeof version !== 'string') return false;
  // Simple check - should be valid semver or range
  // For mock, we'll be lenient
  return version.trim().length > 0;
}

// Helper: Validate rollout value (1-100)
function isValidRollout(rollout) {
  if (rollout === null || rollout === undefined) return true; // Optional
  if (typeof rollout !== 'number') return false;
  return rollout >= 1 && rollout <= 100;
}

// Helper: Validate boolean
function isValidBoolean(val) {
  if (val === null || val === undefined) return true; // Optional
  return typeof val === 'boolean';
}

// Helper: Validate package info
function validatePackageInfo(packageInfo, allOptional = false) {
  const errors = [];
  
  if (!allOptional && !packageInfo.appVersion) {
    errors.push({ field: 'appVersion', message: 'Field is required' });
  }
  
  if (packageInfo.appVersion && !isValidAppVersionRange(packageInfo.appVersion)) {
    errors.push({ field: 'appVersion', message: 'Field is invalid' });
  }
  
  if (packageInfo.rollout !== undefined && !isValidRollout(packageInfo.rollout)) {
    errors.push({ field: 'rollout', message: 'Field is invalid' });
  }
  
  if (packageInfo.isDisabled !== undefined && !isValidBoolean(packageInfo.isDisabled)) {
    errors.push({ field: 'isDisabled', message: 'Field is invalid' });
  }
  
  if (packageInfo.isMandatory !== undefined && !isValidBoolean(packageInfo.isMandatory)) {
    errors.push({ field: 'isMandatory', message: 'Field is invalid' });
  }
  
  return errors;
}

// Helper: Check if rollout is unfinished (< 100)
function isUnfinishedRollout(rollout) {
  return rollout !== null && rollout !== undefined && rollout < 100;
}

// Helper: Generate mock blob URL
function generateBlobUrl() {
  return `https://mock-blob-storage.example.com/packages/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.zip`;
}

// Helper: Generate mock package hash
function generatePackageHash() {
  return Math.random().toString(36).substr(2, 16) + Math.random().toString(36).substr(2, 16);
}

// GET /apps/:appName/deployments/:deploymentName/history - Get package history
function getHistory(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let appName = req.params.appName;
  const deploymentName = req.params.deploymentName;
  let tenantId = getTenantId(req);
  
  // Parse appName if it contains tenant/appName format (e.g., "testOrg/testApp")
  if (appName.includes('/')) {
    const parts = appName.split('/');
    if (parts.length === 2 && !tenantId) {
      tenantId = parts[0];
      appName = parts[1];
    }
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
    return res.status(403).json({ error: 'This action requires Collaborator permissions on the app!' });
  }

  // Get deployments for app
  const appDeployments = db.getDeployments(app.id);
  const deployment = appDeployments.find(d => d.name === deploymentName);
  if (!deployment) {
    return res.status(404).json({ error: `Deployment "${deploymentName}" does not exist.` });
  }

  // Get package history
  const history = db.getPackageHistory(deployment.id);

  return res.status(200).json({ history: history });
}

// POST /apps/:appName/deployments/:deploymentName/release - Create a new release
async function postRelease(req, res) {
  // Handle release request
  
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let appName = req.params.appName;
  const deploymentName = req.params.deploymentName;
  let tenantId = getTenantId(req);
  
  // minimal parsing
  
  // Parse appName if it contains tenant/appName format (e.g., "testOrg/testApp")
  if (appName.includes('/')) {
    const parts = appName.split('/');
    if (parts.length === 2 && !tenantId) {
      tenantId = parts[0];
      appName = parts[1];
      // parsed
    }
  }
  
  // Handle both multipart file upload and JSON-only requests
  let packageInfo = {};
  let uploadedFile = null;
  let fileMetadata = null;
  
  // Check if file was uploaded (multipart/form-data)
  if (req.file) {
    // uploaded file
    uploadedFile = req.file;
    
    // Parse packageInfo from form field (if provided)
    try {
      if (req.body.packageInfo) {
        packageInfo = typeof req.body.packageInfo === 'string' 
          ? JSON.parse(req.body.packageInfo) 
          : req.body.packageInfo;
        // parsed packageInfo
      } else if (req.body.appVersion || req.body.description) {
        // Support flat form fields
        packageInfo = {
          appVersion: req.body.appVersion,
          description: req.body.description,
          isMandatory: req.body.isMandatory === 'true' || req.body.isMandatory === true,
          isDisabled: req.body.isDisabled === 'true' || req.body.isDisabled === true,
          rollout: req.body.rollout ? parseInt(req.body.rollout) : undefined
        };
        // parsed flat fields
      } else {
        // no packageInfo
      }
      
      // Save the uploaded file
      try {
        // saving file
        fileMetadata = await fileStorage.saveFile(uploadedFile.buffer, uploadedFile.originalname);
        // saved file
      } catch (fileError) {
        console.error('   ❌ Error saving file:', fileError);
        return res.status(500).json({ error: 'Failed to save uploaded file' });
      }
    } catch (parseError) {
      console.error('Invalid packageInfo format:', parseError.message);
      return res.status(400).json({ error: 'Invalid packageInfo format' });
    }
  } else {
    // JSON-only request (backward compatible)
    packageInfo = req.body.packageInfo || req.body || {};
    // json body
  }

  // Validate package info (appVersion is required)
  const validationErrors = validatePackageInfo(packageInfo, false);
  if (validationErrors.length) {
    return res.status(400).json(validationErrors);
  }

  // Check if app exists
  const appExists = db.appExists(appName, tenantId);
  if (!appExists) {
    return res.status(404).json({ error: `App "${appName}" does not exist.` });
  }

  // Get app
  const app = db.getAppByName(accountId, appName, tenantId);
  // app details ok

  // If app exists but user doesn't have access, return 403
  if (!app) {
    // No access to app
    return res.status(403).json({ error: 'This action requires Collaborator permissions on the app!' });
  }

  // Get deployments for app
  const appDeployments = db.getDeployments(app.id);
  const deployment = appDeployments.find(d => d.name === deploymentName);
  if (!deployment) {
    return res.status(404).json({ error: `Deployment "${deploymentName}" does not exist.` });
  }

  // Check if there's an unfinished rollout
  const currentPackage = deployment.package;
  if (currentPackage && isUnfinishedRollout(currentPackage.rollout) && !currentPackage.isDisabled) {
    return res.status(409).json({ 
      error: 'Please update the previous release to 100% rollout before releasing a new package.' 
    });
  }

  // Get package history to check for duplicate
  const history = db.getPackageHistory(deployment.id);
  // history size not logged
  
  // Get package hash - use actual hash if file uploaded, otherwise generate mock
  let packageHash;
  let packageSize;
  let blobUrl;
  let fileName = null;
  
  if (fileMetadata) {
    // Real file uploaded - use actual metadata
    packageHash = fileMetadata.hash;
    packageSize = fileMetadata.size;
    fileName = fileMetadata.fileName;
    // Generate download URL via MockServer gateway
    const baseUrl = process.env.MOCK_SERVER_URL || 'http://localhost:1080';
    blobUrl = `${baseUrl}${fileStorage.getDownloadUrl(fileName)}`;
    
    // Check for duplicate package hash with same app version
    const lastPackageWithSameVersion = history
      .slice()
      .reverse()
      .find(pkg => pkg.appVersion === packageInfo.appVersion);
    
    if (lastPackageWithSameVersion && lastPackageWithSameVersion.packageHash === packageHash) {
      // Delete the duplicate file we just saved
      fileStorage.deleteFile(fileName);
      return res.status(409).json({ 
        error: 'A package with the same content hash already exists for this app version.' 
      });
    }
  } else {
    // No file uploaded - use mock values (backward compatible)
    packageHash = generatePackageHash();
    packageSize = packageInfo.size || 1024;
    blobUrl = generateBlobUrl();
  }

  // Get account for releasedBy
  const account = db.getAccount(accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  // Create package data
  const appPackage = {
    appVersion: packageInfo.appVersion,
    blobUrl: blobUrl,
    description: packageInfo.description || null,
    isDisabled: packageInfo.isDisabled !== undefined ? packageInfo.isDisabled : false,
    isMandatory: packageInfo.isMandatory !== undefined ? packageInfo.isMandatory : false,
    packageHash: packageHash,
    rollout: packageInfo.rollout !== undefined ? packageInfo.rollout : null,
    size: packageSize,
    uploadTime: Date.now(),
    releasedBy: account.email,
    releaseMethod: 'Upload',
    manifestBlobUrl: null,
    fileName: fileName
  };

  // Commit package
  let committedPackage;
  try {
    committedPackage = db.commitPackage(deployment.id, appPackage);
  } catch (error) {
    console.error(`Error committing package:`, error);
    return res.status(500).json({ error: error.message });
  }

  // Format response
  const restPackage = {
    appVersion: committedPackage.appVersion,
    blobUrl: committedPackage.blobUrl,
    description: committedPackage.description,
    isDisabled: committedPackage.isDisabled,
    isMandatory: committedPackage.isMandatory,
    label: committedPackage.label,
    packageHash: committedPackage.packageHash,
    rollout: committedPackage.rollout,
    size: committedPackage.size,
    uploadTime: committedPackage.uploadTime,
    releasedBy: committedPackage.releasedBy,
    releaseMethod: committedPackage.releaseMethod
  };

  res.setHeader('Location', `/apps/${appName}/deployments/${deploymentName}`);
  return res.status(201).json({ package: restPackage });
}

// PATCH /apps/:appName/deployments/:deploymentName/release - Update release properties
function patchRelease(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let appName = req.params.appName;
  const deploymentName = req.params.deploymentName;
  let tenantId = getTenantId(req);
  
  // Parse appName if it contains tenant/appName format (e.g., "testOrg/testApp")
  if (appName.includes('/')) {
    const parts = appName.split('/');
    if (parts.length === 2 && !tenantId) {
      tenantId = parts[0];
      appName = parts[1];
    }
  }
  const packageInfo = req.body.packageInfo || req.body || {};

  // Validate package info (all fields optional for update)
  const validationErrors = validatePackageInfo(packageInfo, true);
  if (validationErrors.length) {
    return res.status(400).json(validationErrors);
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
    return res.status(403).json({ error: 'This action requires Collaborator permissions on the app!' });
  }

  // Get deployments for app
  const appDeployments = db.getDeployments(app.id);
  const deployment = appDeployments.find(d => d.name === deploymentName);
  
  if (!deployment) {
    return res.status(404).json({ error: `Deployment "${deploymentName}" does not exist.` });
  }

  // Get package history
  let packageHistory = db.getPackageHistory(deployment.id);
  
  if (!packageHistory || packageHistory.length === 0) {
    return res.status(404).json({ error: 'Deployment has no releases.' });
  }

  // Determine which package to update (by label or latest)
  let packageToUpdate;
  if (packageInfo.label) {
    // Find package by label (search from end)
    for (let i = packageHistory.length - 1; i >= 0; i--) {
      if (packageHistory[i].label === packageInfo.label) {
        packageToUpdate = packageHistory[i];
        break;
      }
    }
    if (!packageToUpdate) {
      return res.status(404).json({ error: 'Release not found for given label.' });
    }
  } else {
    // Use latest package
    packageToUpdate = packageHistory[packageHistory.length - 1];
  }

  let updateRelease = false;
  const updates = {};

  // Update isDisabled
  if (packageInfo.isDisabled !== undefined && packageToUpdate.isDisabled !== packageInfo.isDisabled) {
    updates.isDisabled = packageInfo.isDisabled;
    updateRelease = true;
  }

  // Update isMandatory
  if (packageInfo.isMandatory !== undefined && packageToUpdate.isMandatory !== packageInfo.isMandatory) {
    updates.isMandatory = packageInfo.isMandatory;
    updateRelease = true;
  }

  // Update description
  if (packageInfo.description !== undefined && packageToUpdate.description !== packageInfo.description) {
    updates.description = packageInfo.description;
    updateRelease = true;
  }

  // Update appVersion
  if (packageInfo.appVersion && packageToUpdate.appVersion !== packageInfo.appVersion) {
    updates.appVersion = packageInfo.appVersion;
    updateRelease = true;
  }

  // Update rollout
  if (packageInfo.rollout !== undefined) {
    const newRolloutValue = packageInfo.rollout;
    
    // Validate rollout value
    if (!isValidRollout(newRolloutValue)) {
      return res.status(400).json([{ field: 'rollout', message: 'Field is invalid' }]);
    }

    // Check rollout update rules
    const isFinished = !isUnfinishedRollout(packageToUpdate.rollout);
    if (isFinished && !updateRelease) {
      return res.status(409).json({ error: 'Cannot update rollout value for a completed rollout release.' });
    }

    if (packageToUpdate.rollout !== null && packageToUpdate.rollout !== undefined && 
        packageToUpdate.rollout > newRolloutValue && newRolloutValue !== 100) {
      return res.status(409).json({ 
        error: `Rollout value must be greater than "${packageToUpdate.rollout}", the existing value.` 
      });
    }

    updates.rollout = newRolloutValue === 100 ? 100 : newRolloutValue;
    updateRelease = true;
  }

  // If no updates needed, return 204
  if (!updateRelease) {
    return res.status(204).send();
  }

  // Update the package in history
  Object.assign(packageToUpdate, updates);

  // Update deployment's current package if it's the one being updated
  if (deployment.package && deployment.package.label === packageToUpdate.label) {
    Object.assign(deployment.package, updates);
  }

  // Update package history in database
  try {
    db.updatePackageHistory(deployment.id, packageHistory);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  // Format response
  const restPackage = {
    appVersion: packageToUpdate.appVersion,
    blobUrl: packageToUpdate.blobUrl,
    description: packageToUpdate.description,
    isDisabled: packageToUpdate.isDisabled,
    isMandatory: packageToUpdate.isMandatory,
    label: packageToUpdate.label,
    packageHash: packageToUpdate.packageHash,
    rollout: packageToUpdate.rollout,
    size: packageToUpdate.size,
    uploadTime: packageToUpdate.uploadTime,
    releasedBy: packageToUpdate.releasedBy,
    releaseMethod: packageToUpdate.releaseMethod || 'Upload'
  };

  return res.status(200).json({ package: restPackage });
}

// DELETE /apps/:appName/deployments/:deploymentName/history - Clear package history
function deleteHistory(req, res) {
  const accountId = getUserId(req);
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let appName = req.params.appName;
  const deploymentName = req.params.deploymentName;
  let tenantId = getTenantId(req);
  
  // Parse appName if it contains tenant/appName format (e.g., "testOrg/testApp")
  if (appName.includes('/')) {
    const parts = appName.split('/');
    if (parts.length === 2 && !tenantId) {
      tenantId = parts[0];
      appName = parts[1];
    }
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

  // Get deployments for app
  const appDeployments = db.getDeployments(app.id);
  const deployment = appDeployments.find(d => d.name === deploymentName);
  if (!deployment) {
    return res.status(404).json({ error: `Deployment "${deploymentName}" does not exist.` });
  }

  // Clear package history
  try {
    db.clearPackageHistory(deployment.id);
    return res.status(201).send('Deployment History deleted successfully');
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getHistory,
  postRelease,
  patchRelease,
  deleteHistory
};

