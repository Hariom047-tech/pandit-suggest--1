/**
 * English -> Hindi for admin-authored content (services, pandits, temples).
 *
 * Runs once when an admin saves a service and the result is stored in
 * that record's content_hi column. Deliberately NOT per request: a
 * devotee reading in Hindi should not wait on a model call, and the same
 * paragraph should not be paid for on every page view. The stored Hindi is
 * ordinary editable content afterwards — machine Hindi for ritual vocabulary
 * is exactly what a human needs to be able to correct.
 */

const crypto = require('crypto');
const OpenAI = require('openai');
const { CHAT_MODEL } = require('./ai/config');

let client = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;          // caller treats this as "cannot translate"
  client = new OpenAI({ apiKey });
  return client;
}

/**
 * The instruction matters more than the model here.
 *
 * Hindi devotional writing keeps its Sanskrit-derived vocabulary — a devotee
 * expects "संकल्प", not a literal rendering of "resolution", and "हवन" rather
 * than an invented word for fire ceremony. Translating those away produces
 * text that is technically Hindi and useless to the reader. Deity, ritual and
 * samagri names are therefore transliterated into Devanagari rather than
 * translated, and English words that Indian readers actually use in Hindi
 * (online, booking, WhatsApp) are left alone instead of being forced into
 * archaic equivalents nobody says out loud.
 */
const SYSTEM_PROMPT = `You translate Hindu puja and ritual content from English into natural Hindi for an Indian devotional website.

Rules:
- Write the Hindi a real devotee would read: clear, warm, everyday Devanagari. Not literary or archaic Hindi.
- Deity names, ritual names, mantra names and samagri names stay as themselves, written in Devanagari (Baglamukhi -> बगलामुखी, havan -> हवन, sankalp -> संकल्प, prasad -> प्रसाद).
- Translate EVERY English word. The only exceptions are these everyday loanwords, which stay as they are: online, booking, video call, WhatsApp, PDF, email. Nothing else. Words like invocation, purification, ceremony, offering, devotee and blessing all have ordinary Hindi and must be translated — leaving one in English mid-sentence is the most common failure here.
- Keep the meaning exact. Never add claims, promises or benefits that are not in the English.
- Preserve the structure exactly: same number of array items, in the same order.
- Return ONLY the JSON object asked for, with the same keys as the input. No commentary.`;

/**
 * What each kind of content offers for translation.
 *
 * Deliberately an allow-list per kind rather than "every text column": phone
 * numbers, URLs, slugs and hashes are text too, and a model asked to translate
 * them will cheerfully corrupt them. Street addresses are left out for the
 * same reason in spirit — a transliterated address is prettier and a wrong one
 * stops a devotee reaching the temple. City/district/state stay in, because
 * those are well-known names with settled Hindi spellings.
 *
 *   text        plain strings
 *   lists       arrays of objects; the value is the object keys to translate
 *   stringLists arrays of plain strings
 */
const CONTENT_SPECS = {
  service: {
    text: ['name', 'shortDescription', 'description',
      'estimatedDuration', 'recommendedMuhurat', 'onlineNote'],
    lists: {
      benefits: ['title', 'detail'],
      process: ['title', 'detail', 'duration'],
      // The stored keys really are `q`/`a` (see asFaq in the admin services
      // repository), not question/answer. Getting this wrong is silent: the
      // row yields an empty object, the list is dropped as untranslatable,
      // and the FAQs simply stay English while everything around them turns
      // Hindi — which is exactly how it shipped the first time.
      faqs: ['q', 'a'],
      // `qty` is deliberately absent: quantities are numbers and units, and
      // a model rewriting "2 kg" is a risk with nothing to gain.
      samagri: ['item'],
    },
    stringLists: [],
  },
  pandit: {
    // `name` is a person's name: the prompt transliterates it into Devanagari
    // rather than translating it, which is what the frontend's long-standing
    // `nameHi` field was always meant to hold.
    text: ['name', 'title', 'shortBio', 'bio', 'primarySpecialization',
      'vedicEducation', 'gotra', 'tradition', 'respondsWithin',
      // Shown on every card and on the profile, so a Hindi reader was seeing
      // "Nalkheda" in Latin next to an otherwise fully Hindi card.
      'city', 'state'],
    lists: {},
    stringLists: [],
  },
  temple: {
    text: ['name', 'shortDescription', 'description', 'primaryDeity',
      'templeType', 'architecturalStyle', 'history', 'significance',
      'howToReach', 'nearestRailway', 'nearestAirport',
      'city', 'district', 'state'],
    lists: { customServices: ['name', 'description'] },
    stringLists: ['highlights'],
  },
};

/** Strips empties so the model is never asked to translate "" or null. */
function buildPayload(spec, content) {
  const out = {};
  for (const key of spec.text) {
    const v = content?.[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  for (const [key, subKeys] of Object.entries(spec.lists)) {
    const rows = Array.isArray(content?.[key]) ? content[key] : null;
    if (!rows?.length) continue;
    const mapped = rows.map((row) => {
      const item = {};
      for (const sk of subKeys) {
        const v = row?.[sk];
        if (typeof v === 'string' && v.trim()) item[sk] = v.trim();
      }
      return item;
    });
    if (mapped.some((it) => Object.keys(it).length)) out[key] = mapped;
  }
  for (const key of spec.stringLists) {
    const rows = Array.isArray(content?.[key]) ? content[key] : null;
    if (!rows?.length) continue;
    const mapped = rows.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
    if (mapped.length) out[key] = mapped;
  }
  return out;
}

/**
 * Keeps only what the model was actually asked for, in the shape it was asked
 * for. A model that returns an extra key, a shorter array or a number where a
 * string belongs must not be able to reshape what gets stored — the reader
 * falls back to English per field, so dropping a bad field is always safer
 * than trusting it.
 */
function sanitise(spec, raw, payload) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const key of spec.text) {
    if (!(key in payload)) continue;
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  for (const [key, subKeys] of Object.entries(spec.lists)) {
    if (!(key in payload)) continue;
    const rows = raw[key];
    // Same length or nothing: a partial list would silently pair Hindi item 3
    // with English item 4 once the reader interleaves them by index.
    if (!Array.isArray(rows) || rows.length !== payload[key].length) continue;
    out[key] = rows.map((row) => {
      const item = {};
      for (const sk of subKeys) {
        const v = row?.[sk];
        if (typeof v === 'string' && v.trim()) item[sk] = v.trim();
      }
      return item;
    });
  }
  for (const key of spec.stringLists) {
    if (!(key in payload)) continue;
    const rows = raw[key];
    if (!Array.isArray(rows) || rows.length !== payload[key].length) continue;
    if (rows.every((x) => typeof x === 'string' && x.trim())) out[key] = rows.map((x) => x.trim());
  }
  return Object.keys(out).length ? out : null;
}

/** Extra instruction for kinds where "translate" would be the wrong verb. */
const KIND_HINT = {
  // A person's name is transliterated, never translated: "Acharya Ankit
  // Sharma" is "आचार्य अंकित शर्मा", not a rendering of what the words mean.
  pandit: 'The `name`, `gotra`, `tradition`, `city` and `state` values are proper names — write them in Devanagari as they sound (or with their established Hindi spelling for a place), do not translate their meaning.',
  temple: 'The `name`, `primaryDeity`, `city`, `district`, `state`, `nearestRailway` and `nearestAirport` values are proper names — use their established Hindi spelling, do not translate their meaning.',
};

/**
 * Returns the Hindi content object, or null when there is nothing to translate
 * or the attempt failed.
 *
 * Never throws. A save must not fail because a translation could not be
 * produced — the record is still correct in English, and the Hindi can be
 * regenerated by saving again or written by hand.
 */
/**
 * A short hash per translatable field, taken from the SAME payload the model
 * would be sent.
 *
 * Hashing the payload rather than the raw row is what makes this reliable:
 * buildPayload already trims, drops empties and keeps only the keys in the
 * spec, so re-saving a record without touching its words produces identical
 * hashes even if the row object differs in ways translation cannot see (a new
 * image_url, a changed display_order, whitespace an editor added around a
 * value). That is precisely the case this exists to make free.
 *
 * 16 hex characters, not the full digest: this is stored inside content_hi and
 * travels to the browser with it, and it only ever needs to answer "same text
 * as last time?".
 */
function sourceFingerprints(kind, content) {
  const spec = CONTENT_SPECS[kind];
  if (!spec) throw new Error(`sourceFingerprints: unknown content kind "${kind}"`);
  const payload = buildPayload(spec, content);
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16);
  }
  return out;
}

/**
 * @param {object} [options]
 * @param {string[]} [options.only] translate ONLY these top-level keys. The
 *        model is then billed for, and can only get wrong, the fields that
 *        actually changed; everything else keeps the Hindi it already had.
 */
async function translateToHindi(kind, content, options = {}) {
  const spec = CONTENT_SPECS[kind];
  if (!spec) throw new Error(`translateToHindi: unknown content kind "${kind}"`);

  let payload = buildPayload(spec, content);
  if (options.only) {
    const wanted = new Set(options.only);
    payload = Object.fromEntries(Object.entries(payload).filter(([k]) => wanted.has(k)));
  }
  if (!Object.keys(payload).length) return null;

  const openai = getClient();
  if (!openai) {
    console.warn(`[translate] OPENAI_API_KEY is not set — ${kind} saved without Hindi content`);
    return null;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      // The content is fixed text, not a creative task: the same English
      // should give the same Hindi on a re-save rather than drifting.
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${KIND_HINT[kind] ? KIND_HINT[kind] + '\n\n' : ''}Translate every string value in this JSON into Hindi. Reply with a JSON object having exactly the same keys and array lengths.\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    }, {
      // Request option, not a body field — the API rejects an unknown `timeout`
      // key outright. An admin is waiting on this save, so a slow model call
      // should give up and leave the record in English rather than hold the
      // request open.
      timeout: 30_000,
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) return null;

    const cleaned = sanitise(spec, JSON.parse(text), payload);
    if (!cleaned) return null;

    return { ...cleaned, translatedAt: new Date().toISOString(), model: CHAT_MODEL };
  } catch (err) {
    console.error(`[translate] Hindi translation failed for ${kind}:`, err.message);
    return null;
  }
}

/** Kept so the services controller reads the way it always did. */
const translateServiceToHindi = (service) => translateToHindi('service', service);

module.exports = { translateToHindi, translateServiceToHindi, sourceFingerprints, CONTENT_SPECS };
