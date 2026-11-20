#Requires -RunAsAdministrator
<#
  Windows on Public Wi-Fi often creates inbound Block rules for python.exe.
  Those Block rules win over "MediScan Port 8000" Allow, so Expo Go can load
  Metro (Node) but API calls to :8000 time out.

  Run once in elevated PowerShell:
    powershell -ExecutionPolicy Bypass -File scripts\fix-python-public-firewall.ps1
#>

$blocks = Get-NetFirewallRule |
  Where-Object { $_.DisplayName -eq 'python.exe' -and $_.Action -eq 'Block' -and $_.Direction -eq 'Inbound' }

if (-not $blocks) {
  Write-Host 'No inbound python.exe Block rules found.'
} else {
  foreach ($rule in $blocks) {
    Disable-NetFirewallRule -Name $rule.Name
    Write-Host "Disabled Block rule: $($rule.Name) (Profile=$($rule.Profile))"
  }
}

$existing = Get-NetFirewallRule -DisplayName 'MediScan Port 8000' -ErrorAction SilentlyContinue
if (-not $existing) {
  New-NetFirewallRule -DisplayName 'MediScan Port 8000' -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Any | Out-Null
  Write-Host 'Created MediScan Port 8000 Allow rule.'
} else {
  Enable-NetFirewallRule -DisplayName 'MediScan Port 8000'
  Write-Host 'Ensured MediScan Port 8000 Allow rule is enabled.'
}

Write-Host 'Done. Retry the login from Expo Go (or use the Metro /api proxy without this fix).'
