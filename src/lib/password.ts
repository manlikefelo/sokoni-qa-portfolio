import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id parameters. 19 MiB of memory with two passes is the configuration
 * OWASP currently suggests as a reasonable floor for interactive logins.
 */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, OPTIONS);
}

export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext, OPTIONS);
  } catch {
    // A malformed stored hash is a verification failure, not a crash.
    return false;
  }
}
