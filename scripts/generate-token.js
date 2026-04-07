#!/usr/bin/env node
const crypto = require('crypto')
const token = crypto.randomBytes(32).toString('hex')
console.log('\n🔐 Generated INTERNAL_API_TOKEN:')
console.log(token)
console.log('\nAdd to .env.local:')
console.log(`INTERNAL_API_TOKEN=${token}`)
console.log('\nAdd to Vercel Environment Variables as: INTERNAL_API_TOKEN\n')
