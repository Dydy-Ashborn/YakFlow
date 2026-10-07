# YakFlow · installation Windows en une commande (PowerShell) :
#   irm https://yakflow.netlify.app/installer-windows.ps1 | iex
# Installe (ou met à jour) YakFlow dans %USERPROFILE%\YakFlow, crée un raccourci sur le Bureau, puis lance le studio.
$ErrorActionPreference = 'Stop'
$dest = Join-Path $env:USERPROFILE 'YakFlow'
$url = 'https://yakflow.netlify.app/telecharger/YakFlow.zip'
Write-Host ''
Write-Host '  YakFlow - installation'
Write-Host ''
function Test-Py { try { $v = & py -3 --version 2>&1; if ("$v" -match 'Python 3') { return $true } } catch {}; try { $v = & python --version 2>&1; if ("$v" -match 'Python 3') { return $true } } catch {}; return $false }
if (-not (Test-Py)) {
  Write-Host '  Python 3 est nécessaire. Installation automatique...'
  try { winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements } catch {}
  Write-Host ''
  Write-Host '  Ferme cette fenêtre, ouvre un nouveau PowerShell et relance la même commande.'
  Write-Host '  Si l''installation a échoué : https://www.python.org/downloads/ (coche « Add python.exe to PATH »).'
  return
}
$tmp = Join-Path $env:TEMP ('yakflow-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
Write-Host '  Téléchargement...'
Invoke-WebRequest -Uri $url -OutFile (Join-Path $tmp 'YakFlow.zip') -UseBasicParsing
Expand-Archive -Path (Join-Path $tmp 'YakFlow.zip') -DestinationPath $tmp -Force
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path (Join-Path $tmp 'YakFlow\*') -Destination $dest -Recurse -Force
Remove-Item -Path $tmp -Recurse -Force
Get-ChildItem -Path $dest -Recurse | Unblock-File
$bat = Join-Path $dest 'Lancer YakFlow (Windows).bat'
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'YakFlow.lnk'
$sh = New-Object -ComObject WScript.Shell
$s = $sh.CreateShortcut($lnk); $s.TargetPath = $bat; $s.WorkingDirectory = $dest; $s.Save()
Write-Host "  Installé dans $dest"
Write-Host '  Pour relancer YakFlow plus tard : double-clic sur « YakFlow » sur ton Bureau.'
Start-Process -FilePath $bat -WorkingDirectory $dest
