import { createRequestHandler, ensureDataSource } from "../server/index.mjs";

// Vercel may reuse a function instance between requests. Keep the demo session
// store at module scope so a hosted preview behaves like the local demo server
// for the lifetime of that instance.
const handler = createRequestHandler();

export default async function api(request, response) {
  await ensureDataSource();
  return handler(request, response);
}
