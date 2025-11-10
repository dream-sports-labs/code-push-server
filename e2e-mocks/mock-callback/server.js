const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const accountRoutes = require('./routes/account');
const appsRoutes = require('./routes/apps');
const tenantsRoutes = require('./routes/tenants');
const collaboratorsRoutes = require('./routes/collaborators');
const deploymentsRoutes = require('./routes/deployments');
const releasesRoutes = require('./routes/releases');
const accessKeysRoutes = require('./routes/accesskeys');
const authenticationRoutes = require('./routes/authentication');
const acquisitionRoutes = require('./routes/acquisition');
const fileStorage = require('./utils/file-storage');
const db = require('./mock_data');

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads (memory storage for now, we'll save manually)
// File size limit is configurable via UPLOAD_SIZE_LIMIT_MB environment variable
// - Default: 10240 MB (10GB) - effectively unlimited for most use cases
// - Set to 0 for truly unlimited (uses 1TB as max)
// - Set to any positive number for a specific limit in MB
const UPLOAD_SIZE_LIMIT_MB_ENV = process.env.UPLOAD_SIZE_LIMIT_MB;
let UPLOAD_SIZE_LIMIT_MB;

if (UPLOAD_SIZE_LIMIT_MB_ENV === undefined || UPLOAD_SIZE_LIMIT_MB_ENV === '') {
  // Default: 10GB (effectively unlimited for most use cases)
  UPLOAD_SIZE_LIMIT_MB = 10240;
} else if (parseInt(UPLOAD_SIZE_LIMIT_MB_ENV) === 0) {
  // 0 means unlimited - use 1TB as practical maximum
  UPLOAD_SIZE_LIMIT_MB = 1024 * 1024; // 1TB
} else {
  UPLOAD_SIZE_LIMIT_MB = parseInt(UPLOAD_SIZE_LIMIT_MB_ENV);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_SIZE_LIMIT_MB * 1024 * 1024
  }
});

app.use(bodyParser.json());

// Request logging middleware - controllable via LOG_LEVEL
app.use((req, res, next) => {
  if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl || req.url}`);
  }
  next();
});

app.get("/ping", (req, res) => {
  res.status(200).json({ message: 'pong' });
});

// Test utility routes (for E2E test isolation)
app.post('/api/test/reset-releases', (req, res) => {
  console.log('🔄 Resetting releases for test isolation...');
  db.resetReleases();
  res.status(200).json({ success: true, message: 'All releases cleared' });
});

app.post('/api/test/reset-data', (req, res) => {
  console.log('🔄 Resetting all data for test isolation...');
  db.reset();
  db.initializePreconfiguredData();
  res.status(200).json({ success: true, message: 'All data reset to initial state' });
});

app.post('/api/test/reset-empty', (req, res) => {
  console.log('🔄 Resetting all data to empty state (accounts only, no orgs)...');
  db.reset();
  
  // Create test accounts only (needed for login), but no orgs/apps/deployments
  const testAccountId = 'test-user';
  const testAccount = {
    id: testAccountId,
    name: 'Test User',
    email: 'test@example.com',
    linkedProviders: []
  };
  db.addAccount(testAccount);
  
  const playwrightAccountId = 'test-user-playwright';
  const playwrightAccount = {
    id: playwrightAccountId,
    name: 'Playwright Test User',
    email: 'playwright@example.com',
    linkedProviders: []
  };
  db.addAccount(playwrightAccount);
  
  res.status(200).json({ success: true, message: 'All data cleared to empty state (accounts only)' });
});

// Authentication routes
app.get('/authenticated', authenticationRoutes.getAuthenticated);

// Acquisition routes (public, no auth)
app.get('/updateCheck', acquisitionRoutes.updateCheck);
app.get('/v0.1/public/codepush/update_check', acquisitionRoutes.updateCheck);
app.post('/reportStatus/deploy', acquisitionRoutes.reportStatusDeploy);
app.post('/v0.1/public/codepush/report_status/deploy', acquisitionRoutes.reportStatusDeploy);
app.post('/reportStatus/download', acquisitionRoutes.reportStatusDownload);
app.post('/v0.1/public/codepush/report_status/download', acquisitionRoutes.reportStatusDownload);
app.get('/healthcheck', acquisitionRoutes.healthcheck);

// Account routes
app.get('/account', accountRoutes.getAccount);
app.post('/account', accountRoutes.postAccount);

// Apps routes
app.get('/apps', appsRoutes.getApps);
app.post('/apps', appsRoutes.postApps);
app.get('/apps/:appName', appsRoutes.getApp);
app.patch('/apps/:appName', appsRoutes.patchApp);
app.delete('/apps/:appName', appsRoutes.deleteApp);

// Tenants routes
app.get('/tenants', tenantsRoutes.getTenants);
app.post('/api/v1/new/apps', tenantsRoutes.createTenant); 
app.delete('/tenants/:tenantId', tenantsRoutes.deleteTenant);

// Collaborators routes
app.get('/apps/:appName/collaborators', collaboratorsRoutes.getCollaborators);
app.post('/apps/:appName/collaborators/:email', collaboratorsRoutes.postCollaborator);
app.patch('/apps/:appName/collaborators/:email', collaboratorsRoutes.patchCollaborator);
app.delete('/apps/:appName/collaborators/:email', collaboratorsRoutes.deleteCollaborator);

// Deployments routes
app.get('/apps/:appName/deployments', deploymentsRoutes.getDeployments);
app.post('/apps/:appName/deployments', deploymentsRoutes.postDeployment);
app.get('/apps/:appName/deployments/:deploymentName', deploymentsRoutes.getDeployment);
app.patch('/apps/:appName/deployments/:deploymentName', deploymentsRoutes.patchDeployment);
app.delete('/apps/:appName/deployments/:deploymentName', deploymentsRoutes.deleteDeployment);

// Promote release between deployments
app.post('/apps/:appName/deployments/:sourceDeployment/promote/:targetDeployment', async (req, res) => {
  const accountId = req.headers.authorization?.replace('Bearer ', '');
  if (!accountId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { appName, sourceDeployment, targetDeployment } = req.params;
  const { appVersion, description, isDisabled, isMandatory, label } = req.body;

  // Get source deployment's release
  const app = db.getAppByName(accountId, appName, req.headers.tenant);
  if (!app) {
    return res.status(404).json({ error: 'App not found' });
  }

  const sourceDepl = db.getDeployments(app.id).find(d => d.name === sourceDeployment);
  if (!sourceDepl) {
    return res.status(404).json({ error: `Source deployment "${sourceDeployment}" not found` });
  }

  const targetDepl = db.getDeployments(app.id).find(d => d.name === targetDeployment);
  if (!targetDepl) {
    return res.status(404).json({ error: `Target deployment "${targetDeployment}" not found` });
  }

  // Find the release to promote
  const releaseToPromote = sourceDepl.packageHistory.find(pkg => pkg.label === label);
  if (!releaseToPromote) {
    return res.status(404).json({ error: 'Release not found in source deployment' });
  }

  // Create a copy of the release in target deployment
  const promotedRelease = {
    ...releaseToPromote,
    uploadTime: Date.now(),
    releaseMethod: 'Promote',
    description: description || releaseToPromote.description,
    isDisabled: isDisabled !== undefined ? isDisabled : releaseToPromote.isDisabled,
    isMandatory: isMandatory !== undefined ? isMandatory : releaseToPromote.isMandatory,
  };

  // Add to target deployment
  const committed = db.commitPackage(targetDepl.id, promotedRelease);

  return res.status(201).json({ package: committed });
});

// File serving route - serves uploaded packages
app.get('/packages/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = fileStorage.getFilePath(fileName);
  
  if (!filePath) {
    return res.status(404).json({ error: 'Package file not found' });
  }
  
  // Set appropriate headers for file download
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
  
  fileStream.on('error', (err) => {
    console.error('Error streaming file:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error serving file' });
    }
  });
});

// Error handler for multer file upload errors
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const limitText = UPLOAD_SIZE_LIMIT_MB >= 1024 
        ? `${(UPLOAD_SIZE_LIMIT_MB / 1024).toFixed(1)}GB`
        : `${UPLOAD_SIZE_LIMIT_MB}MB`;
      return res.status(413).json({ 
        error: `The uploaded file is larger than the size limit of ${limitText} (${UPLOAD_SIZE_LIMIT_MB}MB).` 
      });
    }
    // Handle other multer errors
    return res.status(400).json({ 
      error: `File upload error: ${err.message}` 
    });
  }
  // Pass non-multer errors to next error handler
  next(err);
}

// Releases routes
// Support both formats: /apps/appName/... and /apps/tenant/appName/...
// Use wildcard * to match appName with slashes (e.g., "testOrg/testApp")
app.get('/apps/*/deployments/:deploymentName/history', (req, res) => {
  req.params.appName = req.params[0]; // Express captures wildcard in params[0]
  releasesRoutes.getHistory(req, res);
});
// Handle file upload for release endpoint with error handling
app.post('/apps/*/deployments/:deploymentName/release', 
  upload.single('package'), 
  handleMulterError,
  (req, res, next) => {
    req.params.appName = req.params[0]; // Express captures wildcard in params[0]
    releasesRoutes.postRelease(req, res, next);
  });
app.patch('/apps/*/deployments/:deploymentName/release', (req, res) => {
  req.params.appName = req.params[0];
  releasesRoutes.patchRelease(req, res);
});
app.delete('/apps/*/deployments/:deploymentName/history', (req, res) => {
  req.params.appName = req.params[0];
  releasesRoutes.deleteHistory(req, res);
});



// Access Keys routes
app.get('/accessKeys', accessKeysRoutes.getAccessKeys);
app.post('/accessKeys', accessKeysRoutes.postAccessKeys);
app.get('/accessKeys/:accessKeyName', accessKeysRoutes.getAccessKey);
app.patch('/accessKeys/:accessKeyName', accessKeysRoutes.patchAccessKey);
app.delete('/accessKeys/:accessKeyName', accessKeysRoutes.deleteAccessKey);
app.delete('/sessions/:createdBy', accessKeysRoutes.deleteSessions);
app.get('/accountByaccessKeyName', accessKeysRoutes.getAccountByAccessKeyName);

// (removed test-logging endpoint)

// Default 404
app.all('*', (req, res) => {
  res.status(404).json({ message: 'Not handled' });
});

// General error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') {
    console.log(`Mock callback service running on port ${PORT}`);
  }
  db.initializePreconfiguredData();
});
