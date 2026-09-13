import { MongoClient } from 'mongodb';

/**
 * Mark an account's address confirmed, straight in the database.
 *
 * `requireEmailVerification` is on, so `signUpEmail` no longer hands back a
 * session and `signInEmail` refuses the account until the emailed link is
 * opened. Tests about OTHER things — resetting a password, moving an address —
 * should not have to walk the confirmation flow to get a usable session, so
 * they skip it here. The flow itself is covered by
 * tests/integration/signup-verification.test.ts, which walks it for real.
 */
export async function markEmailVerified(email: string): Promise<void> {
  const client = new MongoClient(process.env.MONGODB_URI!);
  try {
    await client.connect();
    const res = await client
      .db()
      .collection('user')
      .updateOne({ email: email.toLowerCase() }, { $set: { emailVerified: true } });
    if (res.matchedCount === 0) throw new Error(`no user row for ${email}`);
  } finally {
    await client.close();
  }
}
