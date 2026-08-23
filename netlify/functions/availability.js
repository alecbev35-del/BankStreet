// Availability feed for Bank Street Quarters.
//
// Fetches each listing's LIVE iCal export (Airbnb/VRBO) server-side, and
// returns ONLY the blocked date ranges. The raw feed contains guest PII
// (reservation IDs, phone digits) in each event's DESCRIPTION/UID — those
// fields are never read here, so they can never reach the browser.
//
// The secret iCal URLs live in Netlify environment variables, NOT the repo:
//   ICAL_MINT, ICAL_VAULT   (add more here as listings are added)
//
// Response is edge-cached for 1 hour (s-maxage), so the on-site calendar
// stays current without hammering Airbnb.

const FEEDS = {
  mint:  'ICAL_MINT',
  vault: 'ICAL_VAULT',
};

// Pull just DTSTART/DTEND (VALUE=DATE) pairs out of the iCal text.
// Everything else — DESCRIPTION, UID, SUMMARY — is deliberately ignored.
function parseBlockedRanges(ics) {
  const ranges = [];
  const events = ics.split('BEGIN:VEVENT').slice(1);
  for (const ev of events) {
    const start = (ev.match(/DTSTART[^:]*:(\d{8})/) || [])[1];
    const end = (ev.match(/DTEND[^:]*:(\d{8})/) || [])[1];
    if (!start || !end) continue;
    ranges.push({ start: iso(start), end: iso(end) }); // end is checkout (exclusive)
  }
  return ranges;
}

function iso(d) {
  return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
}

exports.handler = async function (event) {
  const property = (event.queryStringParameters &&
    event.queryStringParameters.property || '').toLowerCase();

  const envKey = FEEDS[property];
  if (!envKey) {
    return json(400, { error: 'Unknown or missing property', valid: Object.keys(FEEDS) });
  }

  const url = process.env[envKey];
  if (!url) {
    // Not configured yet — return empty rather than erroring, so the UI can
    // fall back to the "book on the listing" button gracefully.
    return json(200, { property, configured: false, blocked: [] });
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'BankStreetQuarters/1.0' } });
    if (!res.ok) throw new Error('feed responded ' + res.status);
    const ics = await res.text();

    const today = new Date().toISOString().slice(0, 10);
    const blocked = parseBlockedRanges(ics)
      .filter(r => r.end >= today)                 // drop past stays
      .sort((a, b) => a.start.localeCompare(b.start));

    return json(200, { property, configured: true, updated: new Date().toISOString(), blocked });
  } catch (err) {
    return json(502, { property, error: 'Could not load availability', detail: String(err) });
  }
};

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      // Fresh for the visitor's session; revalidated at the edge hourly.
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
    body: JSON.stringify(body),
  };
}
