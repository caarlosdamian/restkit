/**
 * Marks accounts created before email verification existed as verified.
 *
 * ⚠️ **Run this before deploying `requireEmailVerification`, or everybody is
 * locked out.** Nothing verified an address at sign-up until now, so every
 * existing user carries `emailVerified: false` (or null, or no field at all).
 * The moment sign-in starts checking that flag, every one of those accounts is
 * refused — the owner, the managers, and the POS terminal mid-shift — and the
 * only way back in is a confirmation mail for an account that never asked for
 * one.
 *
 * It only ever touches users that already existed. A row created after this
 * runs goes through the real flow, so this is safe to re-run and does nothing
 * the second time.
 *
 *   MONGODB_URI=... node scripts/verify-existing-users.mjs           # report only
 *   MONGODB_URI=... node scripts/verify-existing-users.mjs --apply
 */
import { MongoClient } from 'mongodb';

const APPLY = process.argv.includes('--apply');
console.log( process.argv)
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Point it at the database you mean to change.');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db();
const users = db.collection('user');

// Anything that is not exactly `true` would be refused at sign-in, including
// the rows where the field was never written at all.
const unverified = { emailVerified: { $ne: true } };

const total = await users.countDocuments({});
const pending = await users.countDocuments(unverified);

console.log(`${total} user${total === 1 ? '' : 's'} in the database.`);
console.log(`${pending} would be locked out by requireEmailVerification.\n`);

if (pending === 0) {
  console.log('Nothing to do.');
} else {
  const sample = await users.find(unverified).project({ email: 1, role: 1 }).limit(10).toArray();
  for (const u of sample) console.log(`  ${u.email}${u.role ? `  (${u.role})` : ''}`);
  if (pending > sample.length) console.log(`  … and ${pending - sample.length} more`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to mark these verified.');
  } else {
    const res = await users.updateMany(unverified, {
      $set: { emailVerified: true, updatedAt: new Date() },
    });
    const left = await users.countDocuments(unverified);
    console.log(`\nMarked ${res.modifiedCount} verified. ${left} still unverified.`);
    if (left > 0) process.exitCode = 1;
  }
}

await client.close();
