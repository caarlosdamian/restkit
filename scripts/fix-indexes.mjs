/**
 * Brings the database's indexes in line with what the schemas declare.
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
 *   MONGODB_URI=... node scripts/fix-indexes.mjs        # report only
 *   MONGODB_URI=... node scripts/fix-indexes.mjs --apply
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

/**
 * Every unique index the schemas declare, with the query that finds the data
 * that would make it unbuildable.
 *
 * `customers` was the reported bug. `orders` turned up while checking whether
 * anything else had drifted: the database carries a NON-unique `tableId_1_
 * status_1` where models/Order.ts declares a unique partial index on
 * `{ tableId: 1 }` named `uniq_active_order_per_table`. Different name, so
 * Mongoose's create was rejected and the guard against two waiters opening the
 * same table at once has simply never existed here.
 */
const WANTED = [
  {
    collection: 'customers',
    name: 'businessId_1_email_1',
    key: { businessId: 1, email: 1 },
    options: { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
    // At most one customer per business may hold a given email string.
    duplicates: [
      { $match: { email: { $type: 'string' } } },
      { $group: { _id: { businessId: '$businessId', value: '$email' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ],
    stale: ['businessId_1_email_1'],
  },
  {
    collection: 'customers',
    name: 'businessId_1_phone_1',
    key: { businessId: 1, phone: 1 },
    options: { unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
    duplicates: [
      { $match: { phone: { $type: 'string' } } },
      { $group: { _id: { businessId: '$businessId', value: '$phone' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ],
    stale: ['businessId_1_phone_1'],
  },
  {
    collection: 'orders',
    name: 'uniq_active_order_per_table',
    key: { tableId: 1 },
    options: {
      unique: true,
      partialFilterExpression: { status: { $in: ['OPEN', 'IN_KITCHEN', 'READY'] } },
    },
    // Two live orders on one table: the exact thing the index exists to stop.
    duplicates: [
      { $match: { status: { $in: ['OPEN', 'IN_KITCHEN', 'READY'] } } },
      { $group: { _id: { value: '$tableId' }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ],
    // The older auto-named index this replaces.
    stale: ['uniq_active_order_per_table', 'tableId_1_status_1'],
  },
];

/** Does a live index already match what we want, options included? */
function matches(existing, wanted) {
  if (!existing || existing.unique !== true) return false;
  const want = wanted.options.partialFilterExpression;
  if (!want) return !existing.partialFilterExpression;
  return JSON.stringify(existing.partialFilterExpression) === JSON.stringify(want);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db();
const customers = db.collection('customers');

console.log(`${await customers.countDocuments()} customers\n`);

// ── Is this specific number really taken? ──────────────────────────────────
const phoneArg = argValue('--phone');
if (phoneArg) {
  const digits = phoneArg.replace(/\D/g, '');
  const slug = argValue('--slug');
  const business = slug ? await db.collection('businesses').findOne({ slug }) : null;
  if (slug && !business) console.log(`No business with slug "${slug}".\n`);

  const scope = business ? { businessId: business._id } : {};
  const exact = await customers.find({ ...scope, phone: digits }).toArray();
  console.log(`phone ${digits}${business ? ` in "${slug}"` : ' (any business)'}: ${exact.length} match(es)`);
  for (const c of exact) console.log(`   ${c.name} · created ${c.createdAt?.toISOString() ?? '?'}`);

  const loose = await customers
    .find({ ...scope, phone: { $regex: digits.slice(-8).split('').join('\\D*') }, $nor: [{ phone: digits }] })
    .toArray();
  if (loose.length) {
    console.log(`   ${loose.length} more with the same digits in another format:`);
    for (const c of loose) console.log(`     ${c.name} · "${c.phone}"`);
  }
  if (!exact.length) console.log('   → nothing registered under that exact number.');
  console.log('');
}

const work = [];
const skipped = [];

for (const wanted of WANTED) {
  const col = db.collection(wanted.collection);
  const live = await col.indexes();
  const label = `${wanted.collection}.${wanted.name}`;

  if (matches(live.find((i) => i.name === wanted.name), wanted)) {
    console.log(`✓ ${label} already matches the schema`);
    continue;
  }

  const stale = live.filter((i) => wanted.stale.includes(i.name));
  console.log(
    stale.length
      ? `! ${label} — found ${stale.map((i) => `${i.name}(${i.unique ? 'unique' : 'non-unique'}${i.sparse ? ', sparse' : ''})`).join(', ')}, which is not what the schema declares`
      : `+ ${label} is missing and will be created`
  );

  // A unique index cannot be built over data that already violates it, and a
  // half-applied run would leave the collection with no constraint at all.
  const dupes = await col.aggregate(wanted.duplicates).toArray();
  if (dupes.length) {
    // Skip THIS index only. An unrelated collection's bad data must not hold
    // up the one that is breaking enrolment today.
    skipped.push(label);
    console.log(`  ✗ ${dupes.length} row(s) already violate it — resolve these first:`);
    for (const d of dupes.slice(0, 10)) console.log(`      ${JSON.stringify(d._id)} · ${d.n} documents`);
    continue;
  }
  work.push({ ...wanted, drop: stale.map((i) => i.name) });
}

if (!work.length && skipped.length) {
  console.log('\nNothing changed: resolve the conflicts above, then run again.');
} else if (!work.length) {
  console.log('\nNothing to do.');
} else if (!APPLY) {
  console.log(`\nDry run. Re-run with --apply to make ${work.length} change(s).`);
} else {
  for (const item of work) {
    const col = db.collection(item.collection);
    for (const name of item.drop) {
      await col.dropIndex(name);
      console.log(`  dropped ${item.collection}.${name}`);
    }
    await col.createIndex(item.key, { name: item.name, ...item.options });
    console.log(`  created ${item.collection}.${item.name}`);
  }

  // Self-verify. Creating a unique index over violating data throws, so
  // reaching this point already proves the data — this confirms the OPTIONS
  // landed too, which is the part that silently failed for months.
  let ok = true;
  for (const wanted of work) {
    const live = await db.collection(wanted.collection).indexes();
    const good = matches(live.find((i) => i.name === wanted.name), wanted);
    console.log(`  ${good ? '✓' : '✗'} ${wanted.collection}.${wanted.name} ${good ? 'verified' : 'DID NOT take'}`);
    ok &&= good;
  }
  if (skipped.length) console.log(`\nStill unfixed (bad data): ${skipped.join(', ')}`);
  console.log(ok ? '\nDone.' : '\nSomething did not take — re-run and read the output above.');
  if (!ok) process.exitCode = 1;
}

await client.close();
