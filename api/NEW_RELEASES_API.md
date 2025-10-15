# New API Endpoint: Get All Releases for an App

## 📋 Overview

A new API endpoint has been added to retrieve **all releases for an app across all deployments** in a single request.

### Motivation

Previously, to get all releases for an app, you had to:
1. Get all deployments for the app (`GET /apps/:appName/deployments`)
2. For each deployment, get its history (`GET /apps/:appName/deployments/:deploymentName/history`)
3. Manually combine and sort the results

This new endpoint simplifies this workflow by doing all of that server-side.

---

## 🚀 New Endpoint

### **GET `/apps/:appName/releases`**

Get all releases for an app, regardless of which deployment they belong to.

---

## 📥 Request

### **URL Parameters**
- `appName` (string, required) - The name of the app

### **Headers**
- `Authorization` (required) - Bearer token or access key
- `tenant` (optional) - Organization/tenant ID

### **Example Request**
```bash
curl -X GET \
  'https://your-server.com/apps/MyApp/releases' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

---

## 📤 Response

### **Success Response (200 OK)**

```json
{
  "releases": [
    {
      "description": "Bug fixes and performance improvements",
      "label": "v3",
      "appVersion": "1.0.0",
      "isMandatory": false,
      "isDisabled": false,
      "rollout": 100,
      "blobUrl": "https://...",
      "size": 1024000,
      "manifestBlobUrl": "https://...",
      "uploadTime": 1697654400000,
      "packageHash": "abc123...",
      "deploymentName": "Production",
      "deploymentKey": "prod-key-123"
    },
    {
      "description": "New features",
      "label": "v2",
      "appVersion": "1.0.0",
      "isMandatory": true,
      "isDisabled": false,
      "rollout": 50,
      "blobUrl": "https://...",
      "size": 1020000,
      "manifestBlobUrl": "https://...",
      "uploadTime": 1697568000000,
      "packageHash": "def456...",
      "deploymentName": "Staging",
      "deploymentKey": "staging-key-456"
    }
  ],
  "totalCount": 2
}
```

### **Response Fields**

#### Package Fields (from original release):
- `label` (string) - Release version label (e.g., "v1", "v2")
- `appVersion` (string) - Target app version (e.g., "1.0.0")
- `description` (string) - Release description
- `isMandatory` (boolean) - Whether this is a mandatory update
- `isDisabled` (boolean) - Whether this release is disabled
- `rollout` (number) - Rollout percentage (0-100)
- `blobUrl` (string) - URL to download the release package
- `size` (number) - Package size in bytes
- `manifestBlobUrl` (string) - URL to the manifest file
- `uploadTime` (number) - Unix timestamp of when the release was uploaded
- `packageHash` (string) - Hash of the package contents

#### New Fields (added by this endpoint):
- `deploymentName` (string) - Name of the deployment this release belongs to
- `deploymentKey` (string) - Deployment key

#### Response Metadata:
- `totalCount` (number) - Total number of releases across all deployments

### **Sorting**

Releases are sorted by `uploadTime` in **descending order** (most recent first).

---

## 🔒 Authentication & Authorization

- **Authentication**: Required (Bearer token or access key)
- **Permission**: Must have at least `Collaborator` permission on the app
- **Multi-tenancy**: Respects the `tenant` header for organization-scoped apps

---

## ❌ Error Responses

### **404 Not Found**
App doesn't exist or user doesn't have access
```json
{
  "message": "App not found"
}
```

### **401 Unauthorized**
Missing or invalid authentication
```json
{
  "message": "Unauthorized"
}
```

### **403 Forbidden**
User doesn't have permission to view the app
```json
{
  "message": "Insufficient permissions"
}
```

---

## 💡 Use Cases

### 1. **Dashboard Overview**
Display all releases across all environments (Production, Staging, Development) in a single timeline view.

### 2. **Release History**
Show a complete chronological history of all releases for an app.

### 3. **Cross-Deployment Analysis**
Compare releases between different deployments (e.g., "What's the difference between Production v5 and Staging v7?").

### 4. **Rollback Decision**
See all previous releases to decide which version to rollback to.

### 5. **Audit Trail**
Track all releases with deployment context for compliance and auditing.

---

## 🔄 Comparison with Existing Endpoints

### **Old Way** (Multiple Requests)
```bash
# Step 1: Get all deployments
GET /apps/MyApp/deployments
# Returns: ["Production", "Staging", "Development"]

# Step 2: Get history for each deployment (3 separate requests)
GET /apps/MyApp/deployments/Production/history
GET /apps/MyApp/deployments/Staging/history
GET /apps/MyApp/deployments/Development/history

# Step 3: Manually combine and sort results in client
```

### **New Way** (Single Request) ✅
```bash
# One request gets everything
GET /apps/MyApp/releases
# Returns: All releases from all deployments, sorted by time
```

---

## 📊 Performance Considerations

### **Caching**
Consider caching this endpoint if you have many deployments or a large release history.

### **Pagination** (Future Enhancement)
For apps with hundreds of releases, consider adding pagination:
```
GET /apps/:appName/releases?page=1&limit=50
```

### **Filtering** (Future Enhancement)
Potential query parameters to add:
- `?deployment=Production` - Filter by specific deployment
- `?since=1697568000000` - Only releases after timestamp
- `?appVersion=1.0.0` - Only releases for specific app version

---

## 🧪 Testing

### **Test with cURL**
```bash
# Replace with your actual values
APP_NAME="MyApp"
ACCESS_TOKEN="your-access-token"
SERVER_URL="http://localhost:3000"

curl -X GET \
  "${SERVER_URL}/apps/${APP_NAME}/releases" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json"
```

### **Test with CodePush CLI**
While there's no built-in CLI command for this yet, you can test it with:
```bash
code-push-standalone login
# Get your access token from ~/.code-push.config
# Then use curl with that token
```

---

## 🔧 Implementation Details

### **Code Location**
`/api/script/routes/management.ts` - Line ~1087

### **Algorithm**
1. Authenticate user and validate app access
2. Get all deployments for the app
3. Fetch package history for each deployment in parallel
4. Combine all packages and add deployment context
5. Sort by upload time (most recent first)
6. Return combined results

### **Performance**
- Uses `Promise.all()` for parallel history fetching
- Time complexity: O(n * m) where n = deployments, m = avg releases per deployment
- Space complexity: O(total releases)

---

## 📝 Example Frontend Integration

### **React/TypeScript Example**
```typescript
interface Release {
  label: string;
  appVersion: string;
  description: string;
  isMandatory: boolean;
  uploadTime: number;
  deploymentName: string;
  deploymentKey: string;
  // ... other fields
}

interface ReleasesResponse {
  releases: Release[];
  totalCount: number;
}

async function getAllReleases(appName: string): Promise<ReleasesResponse> {
  const response = await fetch(`/apps/${appName}/releases`, {
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch releases');
  }
  
  return response.json();
}

// Usage
const { releases, totalCount } = await getAllReleases('MyApp');
console.log(`Found ${totalCount} releases`);
releases.forEach(release => {
  console.log(`${release.label} (${release.deploymentName}) - ${new Date(release.uploadTime)}`);
});
```

---

## 🎯 Future Enhancements

1. **Pagination**: Add `?page=N&limit=M` query parameters
2. **Filtering**: Add filters for deployment, date range, app version
3. **Sorting Options**: Allow sorting by different fields
4. **Include Metrics**: Optionally include download/install metrics per release
5. **CLI Command**: Add `code-push-standalone app releases <appName>` command

---

## ✅ Summary

**Endpoint**: `GET /apps/:appName/releases`

**Benefits**:
- ✅ Single API call instead of multiple
- ✅ Server-side aggregation and sorting
- ✅ Reduced network overhead
- ✅ Simplified client code
- ✅ Consistent sorting across all clients

**Response**: All releases with deployment context, sorted by time (newest first)

**Authentication**: Required (Collaborator+ permission)

