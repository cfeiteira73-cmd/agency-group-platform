#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════════════
# AGENCY GROUP — SETUP AUTOMÁTICO DE SERVIÇOS EXTERNOS
# Execute: powershell -ExecutionPolicy Bypass -File SETUP_SERVICES.ps1
# ═══════════════════════════════════════════════════════════════════════════════

$Green  = "`e[32m"
$Yellow = "`e[33m"
$Red    = "`e[31m"
$Cyan   = "`e[36m"
$Reset  = "`e[0m"
$Bold   = "`e[1m"

function Write-Step($n, $title) { Write-Host "`n${Bold}${Cyan}[$n/4] $title${Reset}" }
function Write-OK($msg)   { Write-Host "  ${Green}✅ $msg${Reset}" }
function Write-Warn($msg) { Write-Host "  ${Yellow}⚠️  $msg${Reset}" }
function Write-Err($msg)  { Write-Host "  ${Red}❌ $msg${Reset}" }
function Write-Info($msg) { Write-Host "  ${Cyan}→  $msg${Reset}" }

Write-Host "${Bold}${Green}"
Write-Host "╔══════════════════════════════════════════════════════╗"
Write-Host "║     AGENCY GROUP — ACTIVAÇÃO DE SERVIÇOS           ║"
Write-Host "║     AMI 22506 · geral@agencygroup.pt               ║"
Write-Host "╚══════════════════════════════════════════════════════╝${Reset}"

$envFile = Join-Path $PSScriptRoot ".env.local"
$env = Get-Content $envFile | Where-Object { $_ -match "=" -and $_ -notmatch "^#" } | ForEach-Object {
    $parts = $_ -split "=", 2
    @{ Key = $parts[0].Trim(); Value = ($parts[1] ?? "").Trim('"') }
}
function Get-EnvVal($key) { ($env | Where-Object { $_.Key -eq $key }).Value }

# ─────────────────────────────────────────────────────────────────────────────
Write-Step 1 "SUPABASE (Base de Dados)"
# ─────────────────────────────────────────────────────────────────────────────
$supaUrl = Get-EnvVal "NEXT_PUBLIC_SUPABASE_URL"
$supaKey = Get-EnvVal "NEXT_PUBLIC_SUPABASE_ANON_KEY"
$supaService = Get-EnvVal "SUPABASE_SERVICE_ROLE_KEY"

if ($supaUrl -eq "PREENCHER" -or -not $supaUrl) {
    Write-Err "Supabase NÃO configurado"
    Write-Info "Passos:"
    Write-Info "  1. Acede a https://supabase.com/dashboard"
    Write-Info "  2. New Project → Nome: agency-group → Região: West EU (Frankfurt)"
    Write-Info "  3. Aguarda criação (~2 min)"
    Write-Info "  4. Settings → API → copia:"
    Write-Info "     • Project URL → NEXT_PUBLIC_SUPABASE_URL"
    Write-Info "     • anon public → NEXT_PUBLIC_SUPABASE_ANON_KEY"
    Write-Info "     • service_role → SUPABASE_SERVICE_ROLE_KEY"
    Write-Info "  5. SQL Editor → cola o conteúdo de supabase/migrations/001_initial_schema.sql"
    Write-Info "  6. SQL Editor → cola o conteúdo de supabase/migrations/002_seed_properties.sql"
    Write-Info "  7. Corre este script novamente para verificar"
} else {
    Write-OK "SUPABASE_URL configurado: $supaUrl"
    # Test connection
    try {
        $resp = Invoke-RestMethod -Uri "$supaUrl/rest/v1/" -Headers @{ "apikey" = $supaKey } -TimeoutSec 5
        Write-OK "Ligação à Supabase OK"
    } catch {
        Write-Warn "Não foi possível testar ligação (normal se firewall bloquear)"
    }
    # Check if migrations were run
    if ($supaService -ne "PREENCHER") {
        Write-OK "Service Role Key configurada"
        Write-Info "Verifica se as migrations correram:"
        Write-Info "  → https://supabase.com/dashboard → SQL Editor → SELECT COUNT(*) FROM properties;"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Step 2 "GOOGLE OAUTH (Autenticação)"
# ─────────────────────────────────────────────────────────────────────────────
$gClientId = Get-EnvVal "GOOGLE_CLIENT_ID"
$gClientSecret = Get-EnvVal "GOOGLE_CLIENT_SECRET"

if ($gClientId -eq "PREENCHER" -or -not $gClientId) {
    Write-Err "Google OAuth NÃO configurado"
    Write-Info "Passos:"
    Write-Info "  1. https://console.cloud.google.com/apis/credentials"
    Write-Info "  2. Create Project: agency-group-pt"
    Write-Info "  3. OAuth consent screen → External → preenche campos"
    Write-Info "  4. Credentials → Create → OAuth 2.0 Client ID → Web Application"
    Write-Info "  5. Authorized redirect URIs — adiciona AMBAS:"
    Write-Host ""
    Write-Host "     ${Bold}${Yellow}https://www.agencygroup.pt/api/auth/callback/google${Reset}"
    Write-Host "     ${Bold}${Yellow}http://localhost:3000/api/auth/callback/google${Reset}"
    Write-Host ""
    Write-Info "  6. Copia Client ID → GOOGLE_CLIENT_ID no .env.local"
    Write-Info "  7. Copia Client Secret → GOOGLE_CLIENT_SECRET no .env.local"
} else {
    Write-OK "Google OAuth configurado: $($gClientId.Substring(0, [Math]::Min(20, $gClientId.Length)))..."
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Step 3 "WHATSAPP BUSINESS (+351 919948986)"
# ─────────────────────────────────────────────────────────────────────────────
$waPhoneId = Get-EnvVal "WHATSAPP_PHONE_NUMBER_ID"
$waToken = Get-EnvVal "WHATSAPP_ACCESS_TOKEN"

if ($waPhoneId -eq "PREENCHER" -or -not $waPhoneId) {
    Write-Err "WhatsApp Business NÃO configurado"
    Write-Info "Número registado: +351 919948986"
    Write-Info "Passos:"
    Write-Info "  1. https://developers.facebook.com → My Apps → Create App → Business"
    Write-Info "  2. Add Product: WhatsApp"
    Write-Info "  3. Getting Started → adicionar +351 919948986 como número de teste"
    Write-Info "     (ou pedir upgrade para produção se já verificado)"
    Write-Info "  4. Phone Number ID → copia para WHATSAPP_PHONE_NUMBER_ID"
    Write-Info ""
    Write-Info "  Para token PERMANENTE (não expirar em 24h):"
    Write-Info "  5. Business Settings → System Users → Add System User"
    Write-Info "  6. Assign Assets → WhatsApp → Full Control"
    Write-Info "  7. Generate Token → copiar para WHATSAPP_ACCESS_TOKEN"
    Write-Info ""
    Write-Info "  Webhook (quando o app estiver no ar):"
    Write-Host "     ${Bold}${Yellow}https://www.agencygroup.pt/api/whatsapp/webhook${Reset}"
    Write-Host "     ${Bold}${Yellow}Verify Token: agencygroup2026secure${Reset}"
    Write-Host "     ${Bold}${Yellow}Subscrever: messages${Reset}"
} else {
    Write-OK "WhatsApp configurado: Phone ID $waPhoneId"
    # Test WhatsApp API
    try {
        $resp = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/$waPhoneId" `
            -Headers @{ "Authorization" = "Bearer $waToken" } -TimeoutSec 5
        Write-OK "WhatsApp API ligado: $($resp.display_phone_number)"
    } catch {
        Write-Warn "Erro a testar WhatsApp API: $_"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Step 4 "SENTRY (Error Tracking)"
# ─────────────────────────────────────────────────────────────────────────────
$sentryDsn = Get-EnvVal "NEXT_PUBLIC_SENTRY_DSN"
$sentryAuth = Get-EnvVal "SENTRY_AUTH_TOKEN"

if ($sentryDsn -eq "PREENCHER" -or -not $sentryDsn) {
    Write-Err "Sentry NÃO configurado"
    Write-Info "Passos (5 minutos):"
    Write-Info "  1. https://sentry.io → Sign Up com geral@agencygroup.pt"
    Write-Info "  2. Create Organization: Agency Group"
    Write-Info "  3. Create Project → Next.js → nome: agency-group-web"
    Write-Info "  4. DSN (formato: https://xxx@oyyy.ingest.sentry.io/zzz)"
    Write-Info "     → copia para NEXT_PUBLIC_SENTRY_DSN"
    Write-Info "  5. Settings → Auth Tokens → New Token"
    Write-Info "     Scopes: project:releases, org:read, project:read"
    Write-Info "     → copia para SENTRY_AUTH_TOKEN"
} else {
    Write-OK "Sentry DSN configurado"
    # Quick test
    try {
        $parts = $sentryDsn -match "https://(.+)@(.+)/(.+)"
        if ($matches) {
            Write-OK "DSN válido — Org: $($matches[2])"
        }
    } catch {}
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n${Bold}${Green}═══════════════════════════════════════════════════════${Reset}"
Write-Host "${Bold}RESUMO FINAL${Reset}"
Write-Host "${Bold}${Green}═══════════════════════════════════════════════════════${Reset}"

$checks = @(
    @{ Name = "Anthropic API";    Key = "ANTHROPIC_API_KEY";          Val = (Get-EnvVal "ANTHROPIC_API_KEY") },
    @{ Name = "Notion Token";     Key = "NOTION_TOKEN";               Val = (Get-EnvVal "NOTION_TOKEN") },
    @{ Name = "Resend Email";     Key = "RESEND_API_KEY";             Val = (Get-EnvVal "RESEND_API_KEY") },
    @{ Name = "SMTP";             Key = "SMTP_USER";                  Val = (Get-EnvVal "SMTP_USER") },
    @{ Name = "Supabase";         Key = "NEXT_PUBLIC_SUPABASE_URL";   Val = (Get-EnvVal "NEXT_PUBLIC_SUPABASE_URL") },
    @{ Name = "Google OAuth";     Key = "GOOGLE_CLIENT_ID";           Val = (Get-EnvVal "GOOGLE_CLIENT_ID") },
    @{ Name = "WhatsApp";         Key = "WHATSAPP_PHONE_NUMBER_ID";   Val = (Get-EnvVal "WHATSAPP_PHONE_NUMBER_ID") },
    @{ Name = "Sentry";           Key = "NEXT_PUBLIC_SENTRY_DSN";     Val = (Get-EnvVal "NEXT_PUBLIC_SENTRY_DSN") },
    @{ Name = "VAPID Push";       Key = "NEXT_PUBLIC_VAPID_PUBLIC_KEY"; Val = (Get-EnvVal "NEXT_PUBLIC_VAPID_PUBLIC_KEY") },
    @{ Name = "Auth Secret";      Key = "AUTH_SECRET";                Val = (Get-EnvVal "AUTH_SECRET") }
)

foreach ($c in $checks) {
    if ($c.Val -eq "PREENCHER" -or -not $c.Val) {
        Write-Host "  ${Red}❌ $($c.Name)${Reset} — precisa de ser preenchido"
    } else {
        $preview = if ($c.Val.Length -gt 20) { $c.Val.Substring(0, 20) + "..." } else { $c.Val }
        Write-Host "  ${Green}✅ $($c.Name)${Reset} — $preview"
    }
}

Write-Host ""
Write-Host "${Bold}Para arrancar o servidor:${Reset}"
Write-Host "  ${Cyan}cd C:\Users\Carlos\agency-group${Reset}"
Write-Host "  ${Cyan}node node_modules/next/dist/bin/next dev${Reset}"
Write-Host ""
