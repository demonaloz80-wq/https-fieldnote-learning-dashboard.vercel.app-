param(
	[switch]$InstallAtLogon
)

$ErrorActionPreference = "Stop"
$apiDirectory = Join-Path $PSScriptRoot "credentials-api"
$dataDirectory = Join-Path $apiDirectory "data"
$envFile = Join-Path $apiDirectory ".env"

if (-not (Test-Path $envFile)) {
	throw "Missing credentials-api\.env. Configure the API before starting it."
}

$node = Get-Command "node.exe" -ErrorAction Stop
New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null

if ($InstallAtLogon) {
	$taskName = "Fieldnote Credential API"
	$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
	$powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
	$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`""
	$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
	$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
	Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description "Starts the local Fieldnote credential API at sign-in." -Force | Out-Null
	Start-ScheduledTask -TaskName $taskName
	Write-Output "Installed and started the Fieldnote API sign-in task."
	exit 0
}

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
	Write-Output "An API is already listening on port 3000 (PID $($listener.OwningProcess)). Stop the VS Code API task, then run this script again to detach it."
	exit 0
}

$stdoutLog = Join-Path $dataDirectory "api.stdout.log"
$stderrLog = Join-Path $dataDirectory "api.stderr.log"
$process = Start-Process -FilePath $node.Source -ArgumentList @("--env-file=.env", "src/server.js") -WorkingDirectory $apiDirectory -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
Write-Output "Started the Fieldnote API independently of VS Code (PID $($process.Id))."
Write-Output "Dashboard: https://localhost:3000"
Write-Output "Logs: $stdoutLog and $stderrLog"