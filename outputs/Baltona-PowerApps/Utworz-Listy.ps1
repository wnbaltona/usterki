#requires -Version 7.4
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [switch]$Apply,
    [uri]$SiteUrl,
    [guid]$ClientId,
    [switch]$PotwierdzamPrywatnaWitryneTestowa
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$schema = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'schemat-list.json') -Raw | ConvertFrom-Json
$locations = @(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lokale-import.json') -Raw | ConvertFrom-Json)
$settings = @(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'konfiguracja-startowa.json') -Raw | ConvertFrom-Json)

if ($locations.Count -ne 72) { throw 'Import powinien zawierać 72 obiekty.' }
$duplicates = @($locations | Group-Object NumerLokalu | Where-Object Count -gt 1)
if ($duplicates.Count) { throw 'Powtarzające się numery MPK. Przerwano przed połączeniem.' }
foreach ($row in $locations) {
    if ([string]::IsNullOrWhiteSpace($row.NumerLokalu) -or [string]::IsNullOrWhiteSpace($row.Miasto)) { throw 'Niepełny rekord lokalu.' }
}
foreach ($list in $schema.lists) {
    $fieldDuplicates = @($list.fields | Group-Object name | Where-Object Count -gt 1)
    if ($fieldDuplicates.Count) { throw "Powtarzające się pola listy $($list.name)." }
    Write-Output ("{0}: {1} pól; załączniki: {2}" -f $list.name, $list.fields.Count, $list.attachments)
}
Write-Output "Import: $($locations.Count) obiekty. Role: bez fikcyjnych kont. Powiadomienia: wyłączone."

if (-not $Apply -or $WhatIfPreference) {
    Write-Output 'TRYB PLANU. Nie wykonano połączenia ani zmian w SharePoint.'
    return
}
if (-not $SiteUrl -or $SiteUrl.Scheme -ne 'https' -or $ClientId -eq [guid]::Empty) {
    throw 'Dla -Apply podaj adres HTTPS istniejącej witryny i ClientId zatwierdzony przez IT.'
}
if (-not $PotwierdzamPrywatnaWitryneTestowa) {
    throw 'Użyj nowej, prywatnej witryny testowej bez członków biznesowych. Najpierw sprawdź jej uprawnienia.'
}
Import-Module PnP.PowerShell -ErrorAction Stop
if (-not $PSCmdlet.ShouldProcess($SiteUrl.AbsoluteUri, 'Utworzenie 7 list i import 72 obiektów na prywatnej witrynie testowej')) { return }
$connection = Connect-PnPOnline -Url $SiteUrl.AbsoluteUri -ClientId $ClientId.ToString() -Interactive -ReturnConnection
try {
    # Preflight: żadnej podmiany istniejących list ani danych.
    $existing = @(Get-PnPList -Connection $connection)
    $collisions = @($schema.lists | Where-Object { $name = $_.name; $existing | Where-Object Title -eq $name })
    if ($collisions.Count) { throw "Listy już istnieją: $($collisions.name -join ', '). Nie zmieniono żadnej listy. Po częściowym błędzie sprawdź stan ręcznie; skrypt nie usuwa danych." }
    foreach ($list in $schema.lists) {
        New-PnPList -Title $list.name -Url ("Lists/" + $list.name) -Template GenericList -OnQuickLaunch:$false -Connection $connection | Out-Null
        # Nie kopiuje uprawnień członków witryny. Dostęp zachowuje wykonujący operację i administratorzy witryny.
        Set-PnPList -Identity $list.name -BreakRoleInheritance -CopyRoleAssignments:$false -Connection $connection
        Set-PnPList -Identity $list.name -EnableVersioning $true -MajorVersions 100 -EnableAttachments ([bool]$list.attachments) -Connection $connection
        Set-PnPField -List $list.name -Identity Title -Values @{Required=$false} -Connection $connection
        foreach ($field in $list.fields) {
            $arguments = @{List=$list.name; DisplayName=$field.name; InternalName=$field.name; Type=$field.type; Required=[bool]$field.required; AddToDefaultView=$true; Connection=$connection}
            if ($field.type -eq 'Choice') { $arguments.Choices = [string[]]$field.choices }
            Add-PnPField @arguments | Out-Null
            $properties = @{}
            if ($field.index) { $properties.Indexed = $true }
            if ($field.unique) { $properties.Indexed = $true; $properties.EnforceUniqueValues = $true }
            if ($field.type -eq 'Note') { $properties.RichText = $false; $properties.AppendOnly = $false }
            if ($field.type -eq 'Currency') { $properties.CurrencyLocaleId = 1045; $properties.MinimumValue = 0 }
            if ($properties.Count) { Set-PnPField -List $list.name -Identity $field.name -Values $properties -Connection $connection }
        }
        Write-Output "Utworzono listę: $($list.name)"
    }
    foreach ($row in $locations) {
        $values=@{Title="$($row.NumerLokalu) - $($row.NazwaLokalu)"; Miasto=$row.Miasto; NumerLokalu=[string]$row.NumerLokalu; NazwaLokalu=$row.NazwaLokalu; Typ=$row.Typ; Aktywny=[bool]$row.Aktywny; Lokalizacja=$row.Lokalizacja; WierszZrodla=[int]$row.WierszZrodla}
        Add-PnPListItem -List Lokale -Values $values -Connection $connection | Out-Null
    }
    foreach ($setting in $settings) {
        Add-PnPListItem -List Konfiguracja -Values @{Title=$setting.Klucz; Klucz=$setting.Klucz; Wartosc=$setting.Wartosc; Opis=$setting.Opis} -Connection $connection | Out-Null
    }
    $imported = @(Get-PnPListItem -List Lokale -PageSize 200 -Connection $connection)
    if ($imported.Count -ne $locations.Count) { throw 'Liczba zaimportowanych obiektów nie jest zgodna z wejściem.' }
    Write-Output 'Utworzono strukturę i sprawdzono liczbę obiektów. Aplikacja, przepływy oraz uprawnienia biznesowe NIE zostały wdrożone.'
}
finally { Disconnect-PnPOnline -Connection $connection }
