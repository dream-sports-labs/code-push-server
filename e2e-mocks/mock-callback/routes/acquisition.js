const db = require('../mock_data');
const fs = require('fs');
const path = require('path');

// File-based logging function
function writeLog(message) {
  const logFile = '/tmp/update-check.log';
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

// Simple semver check (basic implementation)
function isValidSemver(version) {
  // Basic semver validation: accepts both major.minor.patch and major.minor formats
  // Android versionName can be "1.0" (2 parts) or "1.0.0" (3 parts)
  const semverRegex = /^\d+\.\d+(\.\d+)?(-.+)?$/;
  return semverRegex.test(version);
}

// Normalize version strings (1.0 -> 1.0.0, 1.0.0 -> 1.0.0)
function normalizeVersion(version) {
  const parts = version.split('.');
  while (parts.length < 3) {
    parts.push('0');
  }
  return parts.join('.');
}

// Simple semver satisfies check (basic implementation)
// This should match semver.satisfies() behavior as closely as possible
function semverSatisfies(appVersion, packageAppVersion) {
  // Normalize versions for comparison (1.0 == 1.0.0)
  const normalizedAppVersion = normalizeVersion(appVersion);
  const normalizedPackageVersion = normalizeVersion(packageAppVersion);
  
  if (normalizedAppVersion === normalizedPackageVersion) return true;
  
  // Handle semver ranges (e.g., ">=1.0.0", "*", "1.x", etc.)
  // For now, handle common cases:
  
  // If package version is a range starting with >=
  if (packageAppVersion.startsWith('>=')) {
    const rangeVersion = packageAppVersion.substring(2).trim();
    return semverGreaterThanOrEqual(normalizedAppVersion, normalizeVersion(rangeVersion));
  }
  
  // If package version is "*" or "x", it matches everything
  if (packageAppVersion === '*' || packageAppVersion === 'x') {
    return true;
  }
  
  // Handle "1.x" or "1.0.x" patterns
  if (packageAppVersion.includes('.x')) {
    const pattern = packageAppVersion.replace(/\.x/g, '');
    return normalizedAppVersion.startsWith(normalizeVersion(pattern));
  }
  
  // For exact versions, they should be equal after normalization
  // If package version doesn't match exactly, check if it's a range
  // For now, treat exact versions as requiring exact match
  return normalizedAppVersion === normalizedPackageVersion;
}

// Helper: Check if version1 >= version2
function semverGreaterThanOrEqual(v1, v2) {
  const parts1 = v1.split('.').map(n => parseInt(n || '0'));
  const parts2 = v2.split('.').map(n => parseInt(n || '0'));
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  return true; // Equal
}

// Helper: Check if version1 > version2
function semverGreaterThan(v1, v2) {
  const parts1 = v1.split('.').map(n => parseInt(n || '0'));
  const parts2 = v2.split('.').map(n => parseInt(n || '0'));
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }
  return false; // Equal, so not greater
}

// Check if rollout is unfinished
function isUnfinishedRollout(rollout) {
  return rollout !== null && rollout !== undefined && rollout > 0 && rollout < 100;
}

// GET /updateCheck - Check for available updates
function updateCheck(req, res) {
  const deploymentKey = req.query.deploymentKey || req.query.deployment_key;
  const appVersion = req.query.appVersion || req.query.app_version;
  const clientUniqueId = req.query.clientUniqueId || req.query.client_unique_id;
  const packageHash = req.query.packageHash || req.query.package_hash;
  const label = req.query.label;
  const isCompanion = req.query.isCompanion === 'true' || req.query.is_companion === 'true';
  const newApi = req.originalUrl.includes('v0.1/public/codepush/update_check') || req.path.includes('v0.1/public/codepush/update_check');
  
  // Minimal request log (file), controllable via LOG_LEVEL
  if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') {
    const timestamp = new Date().toISOString();
    writeLog(`[UPDATE CHECK] ${timestamp} key=${deploymentKey} v=${appVersion}`);
  }

  // Validate required fields
  if (!deploymentKey) {
    return res.status(400).send(
      'An update check must include a valid deployment key - please check that your app has been ' +
      'configured correctly. To view available deployment keys, run \'code-push-standalone deployment ls <appName> -k\'.'
    );
  }

  if (!appVersion || !isValidSemver(appVersion)) {
    return res.status(400).send(
      'An update check must include a binary version that conforms to the semver standard (e.g. \'1.0.0\'). ' +
      'The binary version is normally inferred from the App Store/Play Store version configured with your app.'
    );
  }

  // Find deployment by key
  const deployment = db.getDeploymentByKey(deploymentKey);
  if (!deployment) {
  if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') {
    // No matching deployment
  }
    // Return no update if deployment not found
    const noUpdate = {
      updateInfo: {
        isAvailable: false,
        shouldRunBinaryVersion: true,
        appVersion: appVersion
      }
    };
    return res.status(200).send(newApi ? convertToSnakeCase(noUpdate) : noUpdate);
  }
  


  // Get package history
  const packageHistory = db.getPackageHistory(deployment.id);
  
  // (silenced verbose package history logs)
  
  if (!packageHistory || packageHistory.length === 0) {
    if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') {
      // No packages for this app
    }
    // No packages, return no update
    const noUpdate = {
      updateInfo: {
        isAvailable: false,
        shouldRunBinaryVersion: true,
        appVersion: appVersion
      }
    };
    return res.status(200).send(newApi ? convertToSnakeCase(noUpdate) : noUpdate);
  }

  // Find the latest enabled package that satisfies appVersion
  // This logic matches the original server implementation exactly
  let latestEnabledPackage = null;
  let latestSatisfyingPackage = null;
  let foundRequestPackageInHistory = false;
  let rollout = null;
  let shouldMakeUpdateMandatory = false;

  // Search from newest to oldest (reverse order)
  // (silenced detailed scan logs)
  for (let i = packageHistory.length - 1; i >= 0; i--) {
    const pkg = packageHistory[i];
    
    // (scan details removed)
    
    // Check if this is the package the client is currently running
    // Note: If both label and packageHash are missing from request,
    // we can't determine which package the client has, so we'll scan
    // through all packages to find the latest satisfying one
    const isCurrentPackage = 
      (label && pkg.label === label) ||
      (!label && packageHash && pkg.packageHash === packageHash);
    
    // (verbose match logs removed)
    
    foundRequestPackageInHistory = foundRequestPackageInHistory || isCurrentPackage ||
      (!label && !packageHash); // If both missing, we'll treat as "found" after we get latest

    // Skip disabled packages
    if (pkg.isDisabled) {
      // skip disabled
      continue;
    }

    // Track latest enabled package (first non-disabled package we encounter)
    if (!latestEnabledPackage) {
      latestEnabledPackage = pkg;
      // mark latest enabled
    }

    // Check if package satisfies appVersion (or ignore if isCompanion)
    const satisfiesAppVersion = isCompanion || semverSatisfies(appVersion, pkg.appVersion);
    
    if (!satisfiesAppVersion) {
      // doesn't satisfy
      continue; // Skip packages that don't satisfy appVersion
    }

    // Skip unfinished rollout packages for satisfying check (we'll handle rollout separately)
    if (isUnfinishedRollout(pkg.rollout)) {
      rollout = pkg.rollout;
      continue;
    }
      
    // This package satisfies appVersion - track it
    if (!latestSatisfyingPackage) {
      latestSatisfyingPackage = pkg;
      // mark latest satisfying
    }

    // If we found the client's current package, stop scanning
    // All packages further down are older than what the client has
    if (isCurrentPackage) {
      // found current
      break;
    }

    // If this package is mandatory and is newer than what client has,
    // mark the update as mandatory and stop (we have all info needed)
    if (pkg.isMandatory) {
      shouldMakeUpdateMandatory = true;
      break;
    }
  }
  
  // (silenced scan summary)

  // Build response - matches original server structure
  const updateInfo = {
    isAvailable: false,
    shouldRunBinaryVersion: false,
    appVersion: appVersion,
    downloadURL: '',
    packageSize: 0,
    label: '',
    packageHash: '',
    description: '',
    isMandatory: false,
    updateAppVersion: false,
    isBundlePatchingEnabled: false
  };

  // If no satisfying package found
  updateInfo.shouldRunBinaryVersion = !latestSatisfyingPackage;
  
  if (!latestEnabledPackage) {
    // None of the releases in this deployment are enabled
    const response = { updateInfo: updateInfo };
  if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') {
    // No enabled packages
  }
    return res.status(200).send(newApi ? convertToSnakeCase(response) : response);
  }

  // If no satisfying package OR client already has latest, return no update
  const clientHasPackage = (latestSatisfyingPackage && latestSatisfyingPackage.packageHash === packageHash) ||
                           (latestSatisfyingPackage && label && latestSatisfyingPackage.label === label);
  
  // (silenced availability details)
  
  if (updateInfo.shouldRunBinaryVersion || clientHasPackage) {
    // Still provide appVersion info
    if (semverGreaterThan(appVersion, latestEnabledPackage.appVersion)) {
      // Client version is newer than latest package
      updateInfo.appVersion = latestEnabledPackage.appVersion;
    } else if (!semverSatisfies(appVersion, latestEnabledPackage.appVersion)) {
      // Client version doesn't satisfy latest package version
      updateInfo.updateAppVersion = true;
      updateInfo.appVersion = latestEnabledPackage.appVersion;
    }

    const response = { updateInfo: updateInfo };
    // minimal
    return res.status(200).send(newApi ? convertToSnakeCase(response) : response);
  }

  // Update is available
  if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') {
    // Update available
  }
  
  // Update is available - set all fields
  updateInfo.isAvailable = true;
  updateInfo.downloadURL = latestSatisfyingPackage.blobUrl || '';
  updateInfo.packageSize = latestSatisfyingPackage.size || 0;
  updateInfo.label = latestSatisfyingPackage.label || '';
  updateInfo.packageHash = latestSatisfyingPackage.packageHash || '';
  updateInfo.description = latestSatisfyingPackage.description || '';
  // Make mandatory if explicitly set OR if there's a mandatory package newer than client
  updateInfo.isMandatory = shouldMakeUpdateMandatory || (latestSatisfyingPackage.isMandatory || false);
  // Return the same appVersion as requested (for old plugins compatibility)
  updateInfo.appVersion = appVersion;
  updateInfo.isBundlePatchingEnabled = latestSatisfyingPackage.isBundlePatchingEnabled || false;
  rollout = latestSatisfyingPackage.rollout;

  // Handle rollout package selection (simplified)
  let finalUpdateInfo = updateInfo;
  if (rollout && clientUniqueId) {
    // Simplified rollout selection: use clientUniqueId hash
    const hash = simpleHash(clientUniqueId);
    const shouldUseRollout = (hash % 100) < rollout;
    
    if (shouldUseRollout) {
      // Find rollout package
      const rolloutPackage = packageHistory[packageHistory.length - 1];
      if (rolloutPackage && isUnfinishedRollout(rolloutPackage.rollout)) {
        finalUpdateInfo = {
          ...updateInfo,
          downloadURL: rolloutPackage.blobUrl || '',
          packageSize: rolloutPackage.size || 0,
          label: rolloutPackage.label || '',
          packageHash: rolloutPackage.packageHash || '',
          description: rolloutPackage.description || '',
          isMandatory: rolloutPackage.isMandatory || false,
          appVersion: rolloutPackage.appVersion
        };
      }
    }
  }

  finalUpdateInfo.target_binary_range = finalUpdateInfo.appVersion;

  const response = { updateInfo: finalUpdateInfo };
  // Final minimal response log
  if ((process.env.LOG_LEVEL || '').toLowerCase() === 'debug') {
    // Response summary
  }
  return res.status(200).send(newApi ? convertToSnakeCase(response) : response);
}

// Simple hash function for rollout selection
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Convert camelCase to snake_case
function convertToSnakeCase(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertToSnakeCase(item));
  }

  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      result[snakeKey] = convertToSnakeCase(obj[key]);
    }
  }
  return result;
}

// POST /reportStatus/deploy - Report deployment status
function reportStatusDeploy(req, res) {
  const deploymentKey = req.body.deploymentKey || req.body.deployment_key;
  const appVersion = req.body.appVersion || req.body.app_version;
  const label = req.body.label;
  const status = req.body.status;
  const clientUniqueId = req.body.clientUniqueId || req.body.client_unique_id;

  // Validate required fields
  if (!deploymentKey || !appVersion) {
    return res.status(400).send(
      'A deploy status report must contain a valid appVersion and deploymentKey.'
    );
  }

  // If label is provided, status must also be provided and valid
  if (label) {
    if (!status) {
      return res.status(400).send(
        'A deploy status report for a labelled package must contain a valid status.'
      );
    }
    
    const validStatuses = ['DeploymentSucceeded', 'DeploymentFailed', 'Downloaded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).send('Invalid status: ' + status);
    }
  }

  // For older SDK versions, clientUniqueId is required
  // For newer versions (1.5.2-beta+), it's optional
  // For mock, we'll accept requests without clientUniqueId if they have label/status
  // This matches the behavior where newer SDK versions don't require clientUniqueId

  // In the real implementation, this updates Redis with metrics
  // For mock, we just log and return success
// Deploy status received
  
  return res.sendStatus(200);
}

// POST /reportStatus/download - Report download status
function reportStatusDownload(req, res) {
  const deploymentKey = req.body.deploymentKey || req.body.deployment_key;
  const label = req.body.label;

  // Validate required fields
  if (!req.body || !deploymentKey || !label) {
    return res.status(400).send(
      'A download status report must contain a valid deploymentKey and package label.'
    );
  }

  // In the real implementation, this increments download count in Redis
  // For mock, we just log and return success
// Download status received
  
  return res.sendStatus(200);
}

// GET /healthcheck - Health check endpoint
function healthcheck(req, res) {
  // In the real implementation, this checks Storage, Redis, and Memcached
  // For mock, we just return healthy
  return res.status(200).send('Healthy');
}

module.exports = {
  updateCheck,
  reportStatusDeploy,
  reportStatusDownload,
  healthcheck
};

