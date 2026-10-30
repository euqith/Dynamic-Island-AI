# PowerShell Native Bridge for Dynamic Island AI (Windows 10 / 11)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Windows.Forms

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
})[0]

Function Await($WinRtTask, $ResultType) {
    if ($WinRtTask -eq $null) { return $null }
    try {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(2000) | Out-Null
        return $netTask.Result
    } catch {
        return $null
    }
}

try {
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
} catch {}

try {
    [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI, ContentType = WindowsRuntime] | Out-Null
    [Windows.UI.Notifications.NotificationKinds, Windows.UI, ContentType = WindowsRuntime] | Out-Null
} catch {}

$mgr = $null
try {
    $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch {}

$listener = $null
$hasNotifAccess = $false
try {
    $listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
    if ($listener) {
        $access = Await ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
        $hasNotifAccess = ($access -eq [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed)
    }
} catch {}

# Emit ready status
[Console]::Out.WriteLine('{"type":"status","data":"ready"}')
[Console]::Out.Flush()

$seenNotifIds = [System.Collections.Generic.HashSet[uint32]]::new()

# Seed initial notifications to avoid spamming past notifications
if ($hasNotifAccess -and $listener) {
    try {
        $existing = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
        if ($existing) {
            foreach ($n in $existing) {
                $seenNotifIds.Add($n.Id) | Out-Null
            }
        }
    } catch {}
}

$lastMediaHash = ""
$lastBatteryHash = ""
$tick = 0

while ($true) {
    # 1. Check Media Session
    $isPlaying = $false
    if ($mgr) {
        try {
            $session = $mgr.GetCurrentSession()
            if ($session) {
                $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                $info = $session.GetPlaybackInfo()
                $timeline = $session.GetTimelineProperties()

                $title = if ($props -and $props.Title) { $props.Title } else { "" }
                $artist = if ($props -and $props.Artist) { $props.Artist } else { "" }
                $album = if ($props -and $props.AlbumTitle) { $props.AlbumTitle } else { "" }
                $appSource = $session.SourceAppUserModelId
                if (-not $appSource) { $appSource = "Now Playing" }
                
                # Friendly display for common browsers
                if ($appSource -like "*Chrome*") { $appSource = "Chrome / YouTube" }
                elseif ($appSource -like "*msedge*") { $appSource = "Edge" }
                elseif ($appSource -like "*Spotify*") { $appSource = "Spotify" }
                elseif ($appSource -like "*Firefox*") { $appSource = "Firefox" }

                $statusVal = if ($info) { [int]$info.PlaybackStatus } else { 0 }
                $isPlaying = ($statusVal -eq 4) # 4 = Playing
                
                $pos = 0
                $dur = 0
                if ($timeline) {
                    $dur = [math]::Round($timeline.EndTime.TotalSeconds, 1)
                    $basePos = $timeline.Position.TotalSeconds
                    $elapsed = 0
                    if ($isPlaying -and $timeline.LastUpdatedTime) {
                        try {
                            $diff = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds
                            if ($diff -gt 0) { $elapsed = $diff }
                        } catch {}
                    }
                    $calcPos = $basePos + $elapsed
                    if ($dur -gt 0 -and $calcPos -gt $dur) {
                        $calcPos = $dur
                    }
                    $pos = [math]::Round($calcPos, 1)
                }

                $mediaHash = "$title|$artist|$album|$isPlaying|$pos|$dur|$appSource"
                if ($mediaHash -ne $lastMediaHash) {
                    $lastMediaHash = $mediaHash
                    $mediaObj = [PSCustomObject]@{
                        title = if ($title) { $title } else { "Media Audio/Video" }
                        artist = if ($artist) { $artist } else { $appSource }
                        album = $album
                        coverUrl = ""
                        duration = $dur
                        position = $pos
                        isPlaying = $isPlaying
                        hasMedia = $true
                        appSource = $appSource
                    }
                    $json = [PSCustomObject]@{
                        type = "media"
                        data = $mediaObj
                    } | ConvertTo-Json -Compress
                    [Console]::Out.WriteLine($json)
                    [Console]::Out.Flush()
                }
            } else {
                if ($lastMediaHash -ne "NO_MEDIA") {
                    $lastMediaHash = "NO_MEDIA"
                    $noMediaObj = [PSCustomObject]@{
                        title = "Tidak ada media"
                        artist = ""
                        album = ""
                        coverUrl = ""
                        duration = 0
                        position = 0
                        isPlaying = $false
                        hasMedia = $false
                        appSource = ""
                    }
                    $json = [PSCustomObject]@{
                        type = "media"
                        data = $noMediaObj
                    } | ConvertTo-Json -Compress
                    [Console]::Out.WriteLine($json)
                    [Console]::Out.Flush()
                }
            }
        } catch {}
    }

    # 2. Check Notifications
    if ($hasNotifAccess -and $listener) {
        try {
            $notifs = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
            if ($notifs) {
                foreach ($n in $notifs) {
                    if (-not $seenNotifIds.Contains($n.Id)) {
                        $seenNotifIds.Add($n.Id) | Out-Null
                        $bindings = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
                        $nTitle = ""
                        $nBody = ""
                        if ($bindings) {
                            $texts = @($bindings.GetTextElements() | ForEach-Object { $_.Text })
                            if ($texts.Count -gt 0) { $nTitle = $texts[0] }
                            if ($texts.Count -gt 1) { $nBody = ($texts[1..($texts.Count - 1)] -join " ") }
                        }
                        
                        $appName = $n.AppInfo.DisplayInfo.DisplayName
                        if (-not $appName) { $appName = "System" }

                        $notifObj = [PSCustomObject]@{
                            id = [string]$n.Id
                            appName = $appName
                            title = $nTitle
                            body = $nBody
                            timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                        }
                        $json = [PSCustomObject]@{
                            type = "notification"
                            data = $notifObj
                        } | ConvertTo-Json -Compress
                        [Console]::Out.WriteLine($json)
                        [Console]::Out.Flush()
                    }
                }
            }
        } catch {}
    }

    # 3. Check Battery (every 3 cycles)
    if ($tick % 3 -eq 0) {
        try {
            $power = [System.Windows.Forms.SystemInformation]::PowerStatus
            if ($power) {
                $pct = [int]($power.BatteryLifePercent * 100)
                $isCharging = ($power.PowerLineStatus -eq "Online")
                $batHash = "$pct|$isCharging"
                if ($batHash -ne $lastBatteryHash) {
                    $lastBatteryHash = $batHash
                    $batObj = [PSCustomObject]@{
                        type = "charging"
                        batteryPercent = $pct
                        isCharging = $isCharging
                        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    }
                    $json = [PSCustomObject]@{
                        type = "hud"
                        data = $batObj
                    } | ConvertTo-Json -Compress
                    [Console]::Out.WriteLine($json)
                    [Console]::Out.Flush()
                }
            }
        } catch {}
    }

    $tick++
    # Adaptive sleep: 1000ms when playing, 2500ms when idle/no media
    $sleepDuration = if ($isPlaying) { 1000 } else { 2500 }
    Start-Sleep -Milliseconds $sleepDuration
}
