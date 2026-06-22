/**
 * Log in with the device-code flow: the user opens a URL and types a short code,
 * the library polls until the token is issued. No password handling required.
 *
 * Run with:
 *   npx tsx examples/03-device-auth.ts
 */
import { Client } from '../src/index.js';

// No token yet — we are about to obtain one.
const client = new Client({ token: '' });

const auth = await client.deviceAuth(
  (code) => {
    console.log(`Open ${code.verificationUrl} and enter the code: ${code.userCode}`);
  },
  { deviceName: 'my-app' },
);

console.log('Access token:', auth.accessToken);

// Reuse the token for subsequent runs.
const authed = await new Client({ token: auth.accessToken }).init();
const status = await authed.accountStatus();
console.log('Logged in as:', status?.account?.login);
