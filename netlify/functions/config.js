// PUBLIC endpoint — the live site reads prices + review counts from here on load.
// No auth: returns only display data (prices, ratings), never PII.
//
// GET /.netlify/functions/config  ->  { prices, reviews }
import { getJSON } from './_lib/store.js';
import { mergeConfig } from './_lib/defaults.js';

export const handler = async () => {
  const saved = await getJSON('config', null);
  const config = mergeConfig(saved);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      // Fresh per visit but edge-cached briefly so a price change propagates fast.
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
    },
    body: JSON.stringify(config),
  };
};
