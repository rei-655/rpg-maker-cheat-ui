<#
    RPG ツクール MV / MZ のゲームにチート UI を導入・削除する。

    Windows 標準の PowerShell だけで動く。Node.js は不要。
    通常は install.bat から呼び出す。

        powershell -ExecutionPolicy Bypass -File tools/install.ps1
        powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "D:/Games/Game"
        powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "..." -DryRun
        powershell -ExecutionPolicy Bypass -File tools/install.ps1 -GamePath "..." -Uninstall

    -GamePath を省くと自身の周辺からゲームを探し、
    見つからなければ選択ダイアログを開く。

    js/main.js には触れない。上書きするファイルは
    .cheatui-backup-<timestamp> として控えを残す。
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$GamePath,
    [switch]$DryRun,
    [switch]$Uninstall,
    [switch]$NoPrompt
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$PLUGIN_NAME  = 'CheatUILoader'
$ASSET_DIR    = 'cheat-ui'
$BACKUP_STAMP = Get-Date -Format 'yyyyMMddHHmmss'
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot

# 出力
function Write-Step ([string]$verb, [string]$detail) { Write-Host ("  {0,-9}{1}" -f $verb, $detail) }
function Write-Info ([string]$text) { Write-Host $text }
function Write-Warn ([string]$text) { Write-Host $text -ForegroundColor Yellow }
function Write-Fail ([string]$text) { Write-Host $text -ForegroundColor Red }
function Write-Good ([string]$text) { Write-Host $text -ForegroundColor Green }

# MV は www/ 配下、MZ はプロジェクト直下。
function Get-GameLayout ([string]$contentRoot) {
    if (-not (Test-Path -LiteralPath (Join-Path $contentRoot 'index.html') -PathType Leaf)) { return $null }

    $js = Join-Path $contentRoot 'js'
    if (-not (Test-Path -LiteralPath $js -PathType Container)) { return $null }

    if (Test-Path -LiteralPath (Join-Path $js 'rmmz_core.js') -PathType Leaf) {
        return @{ Engine = 'MZ'; ContentRoot = $contentRoot }
    }
    if (Test-Path -LiteralPath (Join-Path $js 'rpg_core.js') -PathType Leaf) {
        return @{ Engine = 'MV'; ContentRoot = $contentRoot }
    }
    return $null
}

# ゲーム内のどのパスでも受け付ける。フォルダ / Game.exe / index.html / www など。
function Resolve-GameLayout ([string]$path) {
    if ([string]::IsNullOrWhiteSpace($path)) { return $null }
    if (-not (Test-Path -LiteralPath $path)) { return $null }

    $item    = Get-Item -LiteralPath $path
    $current = if ($item.PSIsContainer) { $item.FullName } else { $item.DirectoryName }

    for ($depth = 0; $depth -lt 4; $depth++) {
        foreach ($candidate in @($current, (Join-Path $current 'www'))) {
            $layout = Get-GameLayout $candidate
            if ($layout) { return $layout }
        }

        $parent = Split-Path -Parent $current
        if ([string]::IsNullOrEmpty($parent) -or $parent -eq $current) { break }
        $current = $parent
    }
    return $null
}

# ゲームフォルダ内に展開されていれば、尋ねる必要はない。
function Find-NearbyGame {
    foreach ($start in @($PROJECT_ROOT, (Get-Location).Path)) {
        $layout = Resolve-GameLayout $start
        if ($layout) { return $layout }
    }
    return $null
}

function Select-GameWithDialog {
    try {
        Add-Type -AssemblyName System.Windows.Forms
    } catch {
        return $null
    }

    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title  = 'Pick Game.exe or index.html inside the game folder'
    $dialog.Filter = 'RPG Maker (Game.exe;nw.exe;index.html)|Game.exe;nw.exe;index.html|All files (*.*)|*.*'
    $dialog.CheckFileExists = $true

    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
    return $dialog.FileName
}

# 補助
function Backup-File ([string]$path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }

    $target = "$path.cheatui-backup-$BACKUP_STAMP"
    if (-not $DryRun) { Copy-Item -LiteralPath $path -Destination $target -Force }
    return (Split-Path -Leaf $target)
}

# plugins.js には日本語のプラグイン名が入る。BOM の有無もツクールの版で違うため、
# 読み取ったままの形を保つ。
function Read-TextFile ([string]$path) {
    $bytes  = [IO.File]::ReadAllBytes($path)
    $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
    $offset = if ($hasBom) { 3 } else { 0 }

    return @{
        Text   = [Text.Encoding]::UTF8.GetString($bytes, $offset, $bytes.Length - $offset)
        HasBom = $hasBom
    }
}

function Write-TextFile ([string]$path, [string]$text, [bool]$hasBom) {
    if ($DryRun) { return }
    [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding($hasBom)))
}

function Get-PluginEntryJson {
    # 版によらず同じ出力にするため手組みする（5.1 と 7 で ConvertTo-Json の
    # エスケープが違う）。1 式で書くのは、PowerShell では ',' が '+' より強く
    # 結合し、連結した配列が空白区切りの文字列に潰れるため。
    return '{"name":"' + $PLUGIN_NAME + '","status":true,' +
        '"description":"Loads the Cheat UI overlay (RPG Maker MV / MZ)",' +
        '"parameters":{"assetDir":"' + $ASSET_DIR + '","defaultLocale":"auto"}}'
}

# JSON を書き直さずテキストとして挿入するので、既存項目は 1 バイトも変わらない。
# 更新時は自分の項目だけ丸ごと書き直し、古いパラメータを残さない。
function Set-PluginEntry ([string]$text) {
    $lines = $text -split "`n", 0

    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -notmatch ('"name"\s*:\s*"' + [regex]::Escape($PLUGIN_NAME) + '"')) { continue }

        $trailing = if ($lines[$i].TrimEnd() -match ',$') { ',' } else { '' }
        $lines[$i] = (Get-PluginEntryJson) + $trailing
        break
    }

    return ($lines -join "`n")
}

function Add-PluginEntry ([string]$text) {
    $close = $text.LastIndexOf(']')
    if ($close -lt 0) { throw 'no $plugins array found' }

    $head = $text.Substring(0, $close).TrimEnd()
    $last = if ($head.Length -gt 0) { $head[$head.Length - 1] } else { [char]0 }

    $separator = if ($last -eq '[' -or $last -eq ',') { "`n" } else { ",`n" }

    return $head + $separator + (Get-PluginEntryJson) + "`n" + $text.Substring($close)
}

function Remove-PluginEntry ([string]$text) {
    $pattern = ',?\s*\{[^{}]*"name"\s*:\s*"' + [regex]::Escape($PLUGIN_NAME) + '"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    $stripped = [regex]::Replace($text, $pattern, '')

    # 先頭項目だった場合、'[' の直後にカンマが残る。
    return [regex]::Replace($stripped, '\[\s*,', '[')
}

# 「チートランチャー」系プラグインは F9 で <CheatPath>/index.html を別ウィンドウに
# 開く。そのフォルダが無いと ERR_FILE_NOT_FOUND が出るだけで、しかもツクール本体の
# F9 デバッグ画面まで奪う。行き先が実在しないものだけ無効化する。
function Disable-BrokenLaunchers ([string]$text, [string]$contentRoot) {
    $lines    = $text -split "`n", 0
    $disabled = @()

    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]

        if ($line -notmatch '"name"\s*:\s*"([^"]*)"') { continue }
        $name = $Matches[1]

        if ($name -eq $PLUGIN_NAME) { continue }
        if ($name -notmatch '(?i)cheat' -or $name -notmatch '(?i)launch') { continue }
        if ($line -notmatch '"status"\s*:\s*true') { continue }

        $target = if ($line -match '"CheatPath"\s*:\s*"([^"]*)"') { $Matches[1] } else { './.cheat' }
        $folder = Join-Path $contentRoot ($target -replace '^\./', '')

        if (Test-Path -LiteralPath $folder -PathType Container) { continue }

        $lines[$i] = $line -replace '"status"\s*:\s*true', '"status":false'
        $disabled += "$name  (-> $target is missing)"
    }

    return @{ Text = ($lines -join "`n"); Disabled = $disabled }
}

# plugins.js の検証。ConvertFrom-Json は使わない。PowerShell 5.1 のそれは
# 空のプロパティ名を拒むが、ツクールのプラグイン（MOG 系など）は実際に
# "" というパラメータ名を持つことがあり、正当なファイルを弾いてしまう。
#
# こちらは既存の項目を書き換えないので、構造だけ見れば足りる。
function Assert-PluginsJs ([string]$text) {
    $open  = $text.IndexOf('[')
    $close = $text.LastIndexOf(']')
    if ($open -lt 0 -or $close -lt $open) { throw 'no $plugins array found' }

    $array = $text.Substring($open + 1, $close - $open - 1)
    $depth = 0
    $count = 0
    $inString = $false
    $escaped = $false
    $lastMeaningful = ''

    foreach ($ch in $array.ToCharArray()) {
        if ($inString) {
            if ($escaped) { $escaped = $false }
            elseif ($ch -eq [char]92) { $escaped = $true }
            elseif ($ch -eq '"') { $inString = $false }
            continue
        }

        switch ($ch) {
            '"' { $inString = $true }
            '{' { $depth++ }
            '}' {
                $depth--
                if ($depth -lt 0) { throw 'unbalanced braces in $plugins' }
                if ($depth -eq 0) { $count++ }
            }
        }

        if ($ch -notmatch '\s') {
            if ($ch -eq ',' -and $lastMeaningful -eq ',') { throw 'empty entry in $plugins' }
            $lastMeaningful = $ch
        }
    }

    if ($inString) { throw 'unterminated string in $plugins' }
    if ($depth -ne 0) { throw 'unbalanced braces in $plugins' }
    if ($lastMeaningful -eq ',') { throw 'trailing comma in $plugins' }

    return $count
}


# 対象の決定
Write-Info ''
Write-Info 'RPG Maker MV / MZ cheat UI'
Write-Info '--------------------------'

$layout = $null

if ($GamePath) {
    $layout = Resolve-GameLayout $GamePath
    if (-not $layout) {
        Write-Fail "Not an RPG Maker game: $GamePath"
        Write-Info 'Expected index.html plus js/rmmz_core.js (MZ) or js/rpg_core.js (MV).'
        exit 1
    }
} else {
    $layout = Find-NearbyGame
    if ($layout) {
        Write-Info "Found a game at $($layout.ContentRoot)"
    } elseif ($NoPrompt) {
        Write-Fail 'No game found. Pass one with -GamePath.'
        exit 1
    } else {
        Write-Info 'No game found nearby. Opening a file picker.'
        $picked = Select-GameWithDialog

        if (-not $picked) {
            Write-Warn 'Cancelled.'
            exit 1
        }

        $layout = Resolve-GameLayout $picked
        if (-not $layout) {
            Write-Fail "Not an RPG Maker game: $picked"
            Write-Info 'Pick Game.exe or index.html inside the game folder.'
            exit 1
        }
    }
}

$contentRoot  = $layout.ContentRoot
$cheatTarget  = Join-Path $contentRoot $ASSET_DIR
$pluginsDir   = Join-Path $contentRoot 'js\plugins'
$pluginTarget = Join-Path $pluginsDir "$PLUGIN_NAME.js"
$pluginsJs    = Join-Path $contentRoot 'js\plugins.js'

Write-Info ''
Write-Info "  engine   $($layout.Engine)"
Write-Info "  folder   $contentRoot"
if ($DryRun) { Write-Warn '  mode     dry run (nothing is written)' }
Write-Info ''

if (-not (Test-Path -LiteralPath $pluginsJs -PathType Leaf)) {
    Write-Fail "Cannot register the plugin: $pluginsJs is missing"
    exit 1
}

$pluginsFile = Read-TextFile $pluginsJs
$before      = Assert-PluginsJs $pluginsFile.Text
$registered  = $pluginsFile.Text -match ('"' + [regex]::Escape($PLUGIN_NAME) + '"')

# コピーの前に plugins.js の最終形を決める。
# 書けない内容だったときに中途半端な導入を残さないため。
if ($Uninstall) {
    $planned = Remove-PluginEntry $pluginsFile.Text
    $launcher = @{ Disabled = @() }
} else {
    $planned = if ($registered) { Set-PluginEntry $pluginsFile.Text } else { Add-PluginEntry $pluginsFile.Text }
    $launcher = Disable-BrokenLaunchers $planned $contentRoot
    $planned = $launcher.Text
}

$after = Assert-PluginsJs $planned

# 削除
if ($Uninstall) {
    if (Test-Path -LiteralPath $cheatTarget -PathType Container) {
        Write-Step 'delete' $cheatTarget
        if (-not $DryRun) { Remove-Item -LiteralPath $cheatTarget -Recurse -Force }
    }

    if (Test-Path -LiteralPath $pluginTarget -PathType Leaf) {
        Write-Step 'delete' $pluginTarget
        if (-not $DryRun) { Remove-Item -LiteralPath $pluginTarget -Force }
    }

    if ($registered) {
        $saved = Backup-File $pluginsJs

        Write-Step 'unlink' "$pluginsJs  (backup: $saved)"
        Write-TextFile $pluginsJs $planned $pluginsFile.HasBom
    }

    Write-Info ''
    Write-Info "  plugins  $before -> $after"
    Write-Info ''
    if ($DryRun) {
        Write-Good 'Dry run finished. Nothing was removed.'
    } else {
        Write-Good 'Removed. Backup files (.cheatui-backup-*) were left in place.'
    }
    exit 0
}

# 導入
$cheatSource = Join-Path $PROJECT_ROOT 'dist'
if (-not (Test-Path -LiteralPath $cheatSource -PathType Container)) {
    Write-Fail "No build output at $cheatSource"
    Write-Info 'Run npm install && npm run build first.'
    exit 1
}

# 自分が置いたフォルダ以外は消さずに退避する。ゲームが同名のフォルダを
# 持っていることがあり、消してしまうと戻せない。
if (Test-Path -LiteralPath $cheatTarget) {
    if (Test-Path -LiteralPath (Join-Path $cheatTarget 'cheat-ui.js') -PathType Leaf) {
        Write-Step 'replace' $cheatTarget
        if (-not $DryRun) { Remove-Item -LiteralPath $cheatTarget -Recurse -Force }
    } else {
        $moved = "$cheatTarget.cheatui-backup-$BACKUP_STAMP"
        Write-Step 'move' "$cheatTarget  -> $(Split-Path -Leaf $moved)"
        if (-not $DryRun) { Move-Item -LiteralPath $cheatTarget -Destination $moved -Force }
    }
} else {
    Write-Step 'create' $cheatTarget
}
if (-not $DryRun) { Copy-Item -LiteralPath $cheatSource -Destination $cheatTarget -Recurse -Force }

if (-not (Test-Path -LiteralPath $pluginsDir -PathType Container) -and -not $DryRun) {
    New-Item -ItemType Directory -Path $pluginsDir -Force | Out-Null
}

$pluginBackup = Backup-File $pluginTarget
Write-Step $(if ($pluginBackup) { 'replace' } else { 'create' }) $pluginTarget
if (-not $DryRun) {
    Copy-Item -LiteralPath (Join-Path $PROJECT_ROOT "plugin\$PLUGIN_NAME.js") -Destination $pluginTarget -Force
}

if ($planned -eq $pluginsFile.Text) {
    Write-Step 'skip' "$pluginsJs (no change)"
} else {
    $saved = Backup-File $pluginsJs

    $verb = if ($registered) { 'update' } else { 'register' }
    Write-Step $verb "$pluginsJs  (backup: $saved)"

    # 行き先の無いチートランチャーが同梱されていることがある。
    foreach ($name in $launcher.Disabled) {
        Write-Step 'disable' $name
    }

    Write-TextFile $pluginsJs $planned $pluginsFile.HasBom
}

Write-Info ''
Write-Info "  plugins  $before -> $after (existing entries untouched)"
Write-Info '  js/main.js left alone'
Write-Info ''

if ($DryRun) {
    Write-Good 'Dry run finished. Nothing was written.'
} else {
    Write-Good 'Done. Start the game and press Ctrl+C.'
}
if ($pluginBackup) { Write-Info "The previous plugin was saved as $pluginBackup" }
