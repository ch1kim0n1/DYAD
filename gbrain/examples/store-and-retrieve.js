// Store a page and read it back using the GBrain HTTP API.
// Requires: GBrain server running (npm run dev in gbrain/)
// Env vars: GBRAIN_URL (default: http://localhost:3000)
//
// Usage: node examples/store-and-retrieve.js

const baseUrl = process.env.GBRAIN_URL ?? 'http://localhost:3000';

async function main() {
  // POST /pages — store a new page
  const createRes = await fetch(`${baseUrl}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: 'Hello from the store-and-retrieve example!',
      page_kind: 'note',
      tags: ['example', 'demo'],
      metadata: { author: 'example-script', version: 1 },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error('Failed to create page:', createRes.status, err);
    process.exit(1);
  }

  const created = await createRes.json();
  console.log('Created page:', JSON.stringify(created, null, 2));

  const pageId = created.id;

  // GET /pages/:id — retrieve the page we just created
  const getRes = await fetch(`${baseUrl}/pages/${pageId}`);

  if (!getRes.ok) {
    const err = await getRes.text();
    console.error('Failed to retrieve page:', getRes.status, err);
    process.exit(1);
  }

  const page = await getRes.json();
  console.log('\nRetrieved page:', JSON.stringify(page, null, 2));

  if (page.content !== 'Hello from the store-and-retrieve example!') {
    console.error('Content mismatch — something went wrong.');
    process.exit(1);
  }

  console.log('\nRound-trip successful.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
