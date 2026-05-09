// ============================================================================
// Drill-Talk v3.2 (True Final) - Infrastructure as Code Template
// Architecture: Next.js BFF (Gateway) -> Internal VNet -> FastAPI (Backend)
// Security: Zero-Trust (User-Assigned Managed Identity)
// Cost: FinOps Optimized (KEDA Cron Scaling + Budget Alerts)
// ============================================================================

param location string = resourceGroup().location
param projectName string = 'drilltalk'
param environment string = 'prod'
@description('Email address for budget alerts (e.g., admin@example.com)')
param alertEmail string = 'admin@example.com' // <-- 変更箇所：ご自身のメールアドレスを入れるか、コマンドライン引数で渡してください

var baseName = '${projectName}-${environment}'
var uniqueSuffix = uniqueString(resourceGroup().id)
var acrName = 'cr${projectName}${environment}${uniqueSuffix}'
var kvName = take('kv-${baseName}-${uniqueSuffix}', 24)

var defaultTags = {
  Project: 'drilltalk'
  Environment: 'prod'
  ManagedBy: 'Bicep'
  Owner: 'Administrator' // <-- 変更箇所：一般的な名称に変更
}

// 組み込みロールIDの解決
var acrPullRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var kvSecretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

// ----------------------------------------------------------------------------
// 1. 【最優先】共通の身分証（User-Assigned Identity）を作成
// ----------------------------------------------------------------------------
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${baseName}'
  location: location
  tags: defaultTags
}

// ----------------------------------------------------------------------------
// 2. 監視・保管・金庫ゾーン
// ----------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-${baseName}'
  location: location
  tags: defaultTags
  properties: { sku: { name: 'PerGB2018' } }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${baseName}'
  location: location
  tags: defaultTags
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logAnalytics.id }
}

resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: 'budget-${projectName}-monthly'
  properties: {
    amount: 5500
    timeGrain: 'Monthly'
    category: 'Cost'
    timePeriod: { startDate: '2024-01-01T00:00:00Z', endDate: '2030-12-31T00:00:00Z' } // <-- 変更箇所：汎用的な期間に変更
    notifications: {
      Warning50: { enabled: true, operator: 'GreaterThan', threshold: 50, contactEmails: [alertEmail] }
      Warning100: { enabled: true, operator: 'GreaterThan', threshold: 100, contactEmails: [alertEmail] }
    }
  }
}

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
// 3. 権限付与
// ----------------------------------------------------------------------------
resource idAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, managedIdentity.id, 'acrPull-v32-done')
  scope: acr
  properties: {
    roleDefinitionId: acrPullRole
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource idKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, managedIdentity.id, 'kvAccess-v32-done')
  scope: keyVault
  properties: {
    roleDefinitionId: kvSecretsUserRole
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ----------------------------------------------------------------------------
// 4. アプリケーションゾーン
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