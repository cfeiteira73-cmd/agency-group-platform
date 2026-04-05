# WhatsApp Business API Setup

## 1. Meta Developer Account

1. Go to developers.facebook.com
2. Create App → Business type
3. Add "WhatsApp" product to your app
4. Go to WhatsApp → API Setup

## 2. Get Your Credentials

From WhatsApp API Setup page:
- **Phone Number ID**: Copy from "From" dropdown
- **WhatsApp Business Account ID**: Copy from top of page
- **Temporary Access Token**: Click "Generate token" (valid 24h)
- **Permanent Token**: Go to System Users → Add → Admin → Generate Token with whatsapp_business_messaging permission

## 3. Add to .env.local

```env
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_BUSINESS_ACCOUNT_ID=your-waba-id
WHATSAPP_ACCESS_TOKEN=your-permanent-token
WHATSAPP_ACTIVE=true
```

## 4. Configure Webhook

In Meta App → WhatsApp → Configuration:
- **Webhook URL**: `https://your-domain.vercel.app/api/whatsapp/webhook`
- **Verify Token**: `agencygroup2026`
- Subscribe to: `messages`

## 5. Test

```bash
curl -X GET https://your-domain.vercel.app/api/whatsapp/test
curl -X POST https://your-domain.vercel.app/api/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"to": "+351912345678", "message": "Teste Agency Group"}'
```
