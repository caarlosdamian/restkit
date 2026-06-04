export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.logs) console.log('[Apple Wallet]', body.logs);
  return new Response(null, { status: 200 });
}
