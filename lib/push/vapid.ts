// VAPID key generation utility
// Run: node -e "const {generateKeys} = require('./lib/push/vapid'); generateKeys()"
// Or with tsx: npx tsx lib/push/vapid.ts
import crypto from 'crypto'

export function generateKeys(): void {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })

  const pub = (publicKey as Buffer).toString('base64url')
  const priv = (privateKey as Buffer).toString('base64url')

  console.log('\n=== VAPID Keys Generated ===\n')
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pub}`)
  console.log(`VAPID_PRIVATE_KEY=${priv}`)
  console.log('\nAdd these to your .env.local file\n')
}

// Auto-run if executed directly
if (require.main === module) {
  generateKeys()
}
