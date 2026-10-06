// Uruchom lokalnie: node generate-push-keys.mjs
// Wygenerowanych wartości nie publikuj na GitHub.
import { createECDH, randomBytes } from 'node:crypto';
const key=createECDH('prime256v1');key.generateKeys();
console.log(JSON.stringify({VAPID_PUBLIC_KEY:key.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:key.getPrivateKey().toString('base64url'),PUSH_WEBHOOK_TOKEN:randomBytes(32).toString('hex')},null,2));
