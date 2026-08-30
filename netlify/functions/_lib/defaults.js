// Default site config — the shape the public site and the CRM both agree on.
//
// This is what /config returns before the owner has saved anything, and the
// floor that saved values are merged onto. Prices default to null so the public
// site shows a graceful "see rates on Airbnb/VRBO" fallback instead of a broken
// "$—" until a real number is entered in the CRM.
export const DEFAULT_CONFIG = {
  prices: {
    mint: { nightly: null },   // short stay — set in CRM, shows "from $X / night"
    vault: { nightly: null },  // short stay
    trust: { monthly: 2100 },  // monthly lease
    teller: { monthly: 2650 }, // monthly lease
  },
  reviews: {
    // Short-stay units carry live OTA rating + count the owner keeps current.
    mint: { score: '10', scale: '10', label: 'Exceptional', count: 34 },
    vault: { score: '10', scale: '10', label: 'Exceptional', count: 24 },
  },
};

// Deep-ish merge: saved values win, but any key the owner hasn't set falls back
// to the default (so adding a new field in code never blanks the live site).
export function mergeConfig(saved) {
  const out = structuredClone(DEFAULT_CONFIG);
  if (!saved || typeof saved !== 'object') return out;
  for (const section of ['prices', 'reviews']) {
    if (saved[section] && typeof saved[section] === 'object') {
      for (const unit of Object.keys(out[section])) {
        if (saved[section][unit] && typeof saved[section][unit] === 'object') {
          out[section][unit] = { ...out[section][unit], ...saved[section][unit] };
        }
      }
    }
  }
  return out;
}
