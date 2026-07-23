# ============================================================
# SmartSchool — Script de sauvegarde de la base de données
# ============================================================
# Usage manuel :
#   powershell -ExecutionPolicy Bypass -File backup_smartschool.ps1
#
# Ce script :
#   1. Crée un dump SQL horodaté de la base smartschool_db
#   2. Le place dans le dossier .\backups
#   3. Supprime automatiquement les sauvegardes de plus de 30 jours
# ============================================================

# ── Configuration — adapte si besoin ──────────────────────
$PgBinPath   = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
$DbHost      = "localhost"
$DbPort      = "5432"
$DbName      = "smartschool_db"
$DbUser      = "smartschool_user"
$DbPassword  = "SmartSchool2026"
$BackupDir   = Join-Path $PSScriptRoot "backups"
$RetentionDays = 30

# ── Préparation ────────────────────────────────────────────
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = Join-Path $BackupDir "smartschool_$Timestamp.sql"

# pg_dump lit le mot de passe via la variable d'environnement PGPASSWORD
$env:PGPASSWORD = $DbPassword

Write-Host "Sauvegarde en cours vers : $BackupFile"

# ── Exécution du dump ──────────────────────────────────────
& $PgBinPath -h $DbHost -p $DbPort -U $DbUser -d $DbName -F p -f $BackupFile

if ($LASTEXITCODE -eq 0) {
    $SizeKB = [math]::Round((Get-Item $BackupFile).Length / 1KB, 1)
    Write-Host "✅ Sauvegarde réussie ($SizeKB Ko)"
} else {
    Write-Host "❌ Échec de la sauvegarde (code $LASTEXITCODE)"
    Remove-Item $env:PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}

# Nettoyage de la variable de mot de passe
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

# ── Nettoyage des anciennes sauvegardes ────────────────────
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
$OldBackups = Get-ChildItem -Path $BackupDir -Filter "smartschool_*.sql" |
    Where-Object { $_.LastWriteTime -lt $CutoffDate }

if ($OldBackups.Count -gt 0) {
    $OldBackups | Remove-Item -Force
    Write-Host "🧹 $($OldBackups.Count) ancienne(s) sauvegarde(s) supprimée(s) (plus de $RetentionDays jours)"
}

Write-Host "Terminé."
