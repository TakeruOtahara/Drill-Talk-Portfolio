// ============================================================================
// Drill-Talk v3.2 (Public Template)
// Architecture: Next.js BFF (Gateway) -> Internal VNet -> FastAPI (Backend)
// Security: Zero-Trust (User-Assigned Managed Identity)
// Cost: FinOps Optimized (KEDA Cron Scaling + Budget Alerts)
// ============================================================================

@description('Deployment location')
param location string = resourceGroup().location

@description('Project name used for resource naming')
param projectName string = 'drilltalk'

@description('Deployment environment')
param environment string = 'prod'

@description('Email address for budget alerts')
param alertEmail string = 'your-email@example.com'

@description('Your name or organization for resource tagging')
param ownerName string = 'Your Name'

var baseName = '${projectName}-${environment}'
var uniqueSuffix = uniqueString(resourceGroup().id)
var acrName = 'cr${projectName}${environment}${uniqueSuffix}'
var kvName = take('kv-${baseName}-${uniqueSuffix}', 24)

var defaultTags = {
  Project: projectName
  Environment: environment
  ManagedBy: 'Bicep'
  Owner: ownerName
}

// Azure Fixed Role IDs
var acrPullRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var kvSecretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

// ----------------------------------------------------------------------------
// 1. Identity (User-Assigned Managed Identity)
// ----------------------------------------------------------------------------
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${baseName}'
  location: location
  tags: defaultTags
}

// ----------------------------------------------------------------------------
// 2. Monitoring & Governance (FinOps)
// ----------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-${baseName}'
  location: location
  tags: defaultTags
  properties: { 
    sku: { name: 'PerGB2018' } 
    retentionInDays: 30 // Minimize retention cost
    workspaceCapping: {
      dailyQuotaGb: json('0.16') // Safety cap to prevent log-driven cost spikes
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${baseName}'
  location: location
  tags: defaultTags
  kind: 'web'
  properties: { 
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    SamplingPercentage: json('50.0') // Data sampling for cost efficiency
  }
}

resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: 'budget-${projectName}-monthly'
  properties: {
    amount: 5000 // Set your preferred monthly limit (in JPY/Your Currency)
    timeGrain: 'Monthly'
    category: 'Cost'
    timePeriod: { startDate: '2026-05-01T00:00:00Z', endDate: '2030-05-01T00:00:00Z' }
    notifications: {
      Warning50: { enabled: true, operator: 'GreaterThan', threshold: 50, contactEmails: [alertEmail] }
      Warning100: { enabled: true, operator: 'GreaterThan', threshold: 100, contactEmails: [alertEmail] }
    }
  }
}

// ----------------------------------------------------------------------------
// 3. Storage & Security
// ----------------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  tags: defaultTags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: kvName
  location: location
  tags: defaultTags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
  }
}

resource secretGemini 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'GEMINI-API-KEY'
  properties: { value: 'initial-placeholder-value' }
}

resource secretInternal 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'DRILLTALK-INTERNAL-KEY'
  properties: { value: uniqueString(resourceGroup().id) }
}

// ----------------------------------------------------------------------------
// 4. RBAC Role Assignments
// ----------------------------------------------------------------------------
resource idAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, managedIdentity.id, 'acrPull-role')
  scope: acr
  properties: {
    roleDefinitionId: acrPullRole
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource idKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, managedIdentity.id, 'kvAccess-role')
  scope: keyVault
  properties: {
    roleDefinitionId: kvSecretsUserRole
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ----------------------------------------------------------------------------
// 5. Container Apps Infrastructure
// ----------------------------------------------------------------------------
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'cae-${baseName}'
  location: location
  tags: defaultTags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Backend (FastAPI)
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'aca-${baseName}-backend'
  location: location
  tags: defaultTags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${managedIdentity.id}': {} }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      secrets: [
        { name: 'gemini-api-key', keyVaultUrl: '${keyVault.properties.vaultUri}secrets/GEMINI-API-KEY', identity: managedIdentity.id }
        { name: 'drilltalk-internal-key', keyVaultUrl: '${keyVault.properties.vaultUri}secrets/DRILLTALK-INTERNAL-KEY', identity: managedIdentity.id }
      ]
      ingress: { external: false, targetPort: 8000 }
      registries: [{ server: acr.properties.loginServer, identity: managedIdentity.id }]
    }
    template: {
      containers: [{
        name: 'backend'
        image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        env: [
          { name: 'DRILLTALK_API_KEY', secretRef: 'drilltalk-internal-key' }
          { name: 'GEMINI_API_KEY', secretRef: 'gemini-api-key' }
          { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        ]
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
      }]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'business-hours-scaler'
            custom: { type: 'cron', metadata: { timezone: 'Asia/Tokyo', start: '0 8 * * *', end: '0 0 * * *', desiredReplicas: '1' } }
          }
        ]
      }
    }
  }
  dependsOn: [ idKvAccess, idAcrPull, secretGemini, secretInternal ]
}

// Frontend (Next.js)
resource frontendApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'aca-${baseName}-frontend'
  location: location
  tags: defaultTags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${managedIdentity.id}': {} }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      secrets: [
        { name: 'drilltalk-internal-key', keyVaultUrl: '${keyVault.properties.vaultUri}secrets/DRILLTALK-INTERNAL-KEY', identity: managedIdentity.id }
      ]
      ingress: { external: true, targetPort: 3000 }
      registries: [{ server: acr.properties.loginServer, identity: managedIdentity.id }]
    }
    template: {
      containers: [{
        name: 'frontend'
        image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
        env: [
          { name: 'BACKEND_URL', value: 'http://${backendApp.properties.configuration.ingress.fqdn}' }
          { name: 'DRILLTALK_API_KEY', secretRef: 'drilltalk-internal-key' }
          { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        ]
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
      }]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'business-hours-scaler'
            custom: { type: 'cron', metadata: { timezone: 'Asia/Tokyo', start: '0 8 * * *', end: '0 0 * * *', desiredReplicas: '1' } }
          }
        ]
      }
    }
  }
  dependsOn: [ idKvAccess, idAcrPull, secretInternal ]
}