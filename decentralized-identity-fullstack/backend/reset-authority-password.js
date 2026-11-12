import { readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { hashPassword } from './src/auth.js';

const email = 'authority@verichain.local';
const password = process.env.NEW_AUTH_PASSWORD;

if (!password || password.length < 12 || password.length > 128) {
  console.error('Password must contain 12–128 characters.');
  process.exit(1);
}

const usersPath = new URL('./src/users.json', import.meta.url);
const users = JSON.parse(await readFile(usersPath, 'utf8'));

const authority = users.find(
  user => user.email === email && user.role === 'authority'
);

if (!authority) {
  console.error('Authority account not found. No changes made.');
  process.exit(1);
}

// Preserve a backup before changing the password.
await copyFile(usersPath, new URL('./src/users.json.backup', import.meta.url));

authority.passwordHash = await hashPassword(password);

const temporaryPath = new URL('./src/users.json.tmp', import.meta.url);
await writeFile(temporaryPath, JSON.stringify(users, null, 2));
await rename(temporaryPath, usersPath);

console.log('Authority password reset successfully.');
console.log('Only the authority password hash was changed.');