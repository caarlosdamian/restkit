/**
 * Replaces the customers collection's stale `sparse` uniques with the partial
 * ones the schema asks for.
 *
 * ⚠️ **Mongoose cannot change an existing index.** `models/Customer.ts` has
 * declared `partialFilterExpression` for a long time, but a database created
 * before that still carries `sparse: true` under the same index NAME — Mongo
 * answers IndexOptionsConflict and the old index simply stays. Nothing in the
 * app surfaces that.
 *
 * What it cost: a compound sparse index indexes any document holding at least
 * ONE of its fields, so every customer with a businessId and no email was
 * indexed as `(businessId, null)`. The FIRST self-enrolment at a business
 * worked; the second collided on the EMAIL index and the route reported it as
 * "ya tienes una tarjeta con este teléfono" — to someone whose number was new.
 *
 *   MONGODB_URI=... node scripts/fix-customer-indexes.mjs        # report only
 *   MONGODB_URI=... node scripts/fix-customer-indexes.mjs --apply
 *
 * `--phone 5512345678 [--slug cafe-luna]` also answers the question the error
 * message raises but cannot settle: is this number ACTUALLY registered, or did
 * the insert collide on some other index? The deployed route returns the same
 * body either way, so only the database can tell you.
 *
 * Idempotent, and refuses to act while real duplicates would make the new
 * unique index impossible to build.
 */
import { MongoClient } from 'mongodb';

const APPLY = process.argv.includes('--apply');
const argValue = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Point it at the database you mean to change.');
  process.exit(1);
}

const WANTED = [
  { name: 'businessId_1_email_1', key: { businessId: 1, email: 1 }, field: 'email' },
  { name: 'businessId_1_phone_1', key: { businessId: 1, phone: 1 }, field: 'phone' },
];

const client = new MongoClient(uri);
await client.connect();
const customers = client.db().collection('customers');

console.log(`${await customers.countDocuments()} customers\n`);

// ── Is this specific number really taken? ──────────────────────────────────
const phoneArg = argValue('--phone');
if (phoneArg) {
  const digits = phoneArg.replace(/\D/g, '');
  const slug = argValue('--slug');
  const business = slug ? await client.db().collection('businesses').findOne({ slug }) : null;
  if (slug && !business) console.log(`No business with slug "${slug}".\n`);

  const scope = business ? { businessId: business._id } : {};
  // Exactly what the join route looks for: the 10-digit form, scoped to the
  // business. Anything else in the collection is a different customer.
  const exact = await customers.find({ ...scope, phone: digits }).toArray();
  console.log(`phone ${digits}${business ? ` in "${slug}"` : ' (any business)'}: ${exact.length} match(es)`);
  for (const c of exact) console.log(`   ${c.name} · created ${c.createdAt?.toISOString() ?? '?'}`);

  // A phone stored in some other shape is a different customer as far as the
  // unique index is concerned, but the same human at the counter.
  // Stored phones are not all bare digits — seeded and till-entered ones look
  // like "+52 55 1111 1111". Match the last 8 digits with anything between.
  const loose = await customers
    .find({
      ...scope,
      phone: { $regex: digits.slice(-8).split('').join('\\D*'), $options: '' },
      $nor: [{ phone: digits }],
    })
    .toArray();
  if (loose.length) {
    console.log(`   ${loose.length} more with the same digits in another format:`);
    for (const c of loose) console.log(`     ${c.name} · "${c.phone}"`);
  }
  if (!exact.length) {
    console.log('   → nothing registered. An ALREADY_ENROLLED for this number is the index bug below.');
  }
  console.log('');
}

// How much of the collection the stale index actually breaks: every customer
// without an email string occupies the same (businessId, null) slot.
const noEmail = await customers
  .aggregate([
    { $match: { email: { $not: { $type: 'string' } } } },
    { $group: { _id: '$businessId', n: { $sum: 1 } } },
    { $match: { n: { $gt: 0 } } },
  ])
  .toArray();
if (noEmail.length) {
  console.log('customers with no email (the ones a sparse index collides):');
  for (const g of noEmail) console.log(`   business ${g._id}: ${g.n}`);
  console.log('');
}

let blocked = false;
const work = [];

for (const wanted of WANTED) {
  const existing = (await customers.indexes()).find((i) => i.name === wanted.name);
  const partial = existing?.partialFilterExpression?.[wanted.field]?.$type === 'string';

  if (partial) {
    console.log(`✓ ${wanted.name} is already partial`);
    continue;
  }
  if (!existing) {
    console.log(`+ ${wanted.name} is missing and will be created`);
    work.push({ ...wanted, drop: false });
    continue;
  }
  console.log(`! ${wanted.name} is ${existing.sparse ? 'sparse' : 'plain'} — it indexes null and must be replaced`);

  // A unique partial index cannot be built over real duplicates. Find them
  // first: failing halfway would leave the collection with no unique at all.
  const dupes = await customers
    .aggregate([
      { $match: { [wanted.field]: { $type: 'string' } } },
      { $group: { _id: { businessId: '$businessId', value: `$${wanted.field}` }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  if (dupes.length) {
    blocked = true;
    console.log(`  ✗ ${dupes.length} real duplicate ${wanted.field}(s) in the data — merge these first:`);
    for (const d of dupes.slice(0, 10)) {
      console.log(`      business ${d._id.businessId} · ${wanted.field} ${d._id.value} · ${d.n} customers`);
    }
    continue;
  }
  work.push({ ...wanted, drop: true });
}

if (blocked) {
  console.log('\nNothing changed: fix the duplicates above, then run again.');
} else if (!work.length) {
  console.log('\nNothing to do.');
} else if (!APPLY) {
  console.log(`\nDry run. Re-run with --apply to make ${work.length} change(s).`);
} else {
  for (const item of work) {
    if (item.drop) {
      await customers.dropIndex(item.name);
      console.log(`  dropped ${item.name}`);
    }
    await customers.createIndex(item.key, {
      name: item.name,
      unique: true,
      partialFilterExpression: { [item.field]: { $type: 'string' } },
    });
    console.log(`  created ${item.name} (partial)`);
  }
  // Self-verify. Creating a unique index over duplicate data throws, so
  // reaching this point already proves the data is clean — this confirms the
  // OPTIONS landed too, which is the thing that silently failed for months.
  const after = await customers.indexes();
  let ok = true;
  for (const wanted of WANTED) {
    const idx = after.find((i) => i.name === wanted.name);
    const partial = idx?.partialFilterExpression?.[wanted.field]?.$type === 'string';
    console.log(`  ${partial ? '✓' : '✗'} ${wanted.name} ${partial ? 'is partial' : 'DID NOT take'}`);
    ok &&= partial;
  }
  console.log(ok ? '\nDone.' : '\nSomething did not take — re-run and read the output above.');
  if (!ok) process.exitCode = 1;
}

await client.close();
