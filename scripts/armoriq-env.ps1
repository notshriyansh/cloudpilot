$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$credentialsPath = Join-Path $HOME ".armoriq\credentials.json"
$localSecretsPath = Join-Path $repoRoot ".secrets\armoriq.local.json"
$configPath = Join-Path $repoRoot "armoriq.yaml"

if (-not (Test-Path $credentialsPath)) {
    throw "ArmorIQ CLI credentials not found. Run armoriq login first."
}

if (-not (Test-Path $localSecretsPath)) {
    throw "Local MCP credentials missing. Create .secrets\armoriq.local.json first."
}

if (-not (Test-Path $configPath)) {
    throw "armoriq.yaml not found in the repository root."
}

$credentials = Get-Content $credentialsPath -Raw | ConvertFrom-Json
$localSecrets = Get-Content $localSecretsPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($credentials.apiKey)) {
    throw "ArmorIQ API key is missing from CLI credentials."
}

if ([string]::IsNullOrWhiteSpace($localSecrets.mcpToken)) {
    throw "Local CloudPilot MCP token is empty."
}

$env:ARMORIQ_ENV = "production"
$env:BACKEND_ENDPOINT = "https://api.armoriq.ai"
$env:IAP_ENDPOINT = "https://iap.armoriq.ai"
$env:PROXY_ENDPOINT = "https://proxy.armoriq.ai"
$env:ARMORIQ_API_KEY = $credentials.apiKey
$env:CLOUDPILOT_MCP_TOKEN = $localSecrets.mcpToken

$mcpCredentials = @{
    cloudpilot = @{
        authType = "bearer"
        token = $env:CLOUDPILOT_MCP_TOKEN
    }
}

$env:ARMORIQ_MCP_CREDENTIALS = $mcpCredentials | ConvertTo-Json -Compress

"CloudPilot ArmorIQ environment ready."
"API key: loaded"
"MCP credentials: loaded"
"Endpoints: configured"
