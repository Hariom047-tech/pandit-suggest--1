/**
 * Query understanding — STEP 8.
 *
 * Turns a free-text message into a structured intent object BEFORE any
 * retrieval happens, so the rest of the pipeline works on facts rather than
 * prose.
 *
 * Deliberately deterministic first, LLM second. Everything below runs with no
 * network call, because the parts that matter most — "the user named Nalkheda",
 * "the user is in crisis", "the user asked for online" — must never depend on
 * an API being up, and must never be quietly re-interpreted by a model. The
 * LLM refinement in enrichWithLLM() only fills gaps the rules left empty; it
 * cannot overwrite an explicit extraction.
 *
 * No database access here. Vocabularies are passed in by the caller (loaded
 * from ai_problem_categories, temples and services), so this module stays
 * pure and testable.
 */

/* ── language ─────────────────────────────────────────────────────────── */

const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * Hinglish markers. Chosen to be words that are common in romanised Hindi but
 * effectively absent from English, so a sentence like "my business is not
 * growing" is not misread as Hinglish.
 */
/**
 * Romanised-Hindi markers.
 *
 * Deliberately includes heavy SMS-style abbreviation, because that is how
 * people actually type. "merko business me career bnana h" was classified as
 * English and answered in English — only "me" matched, and one marker in six
 * words fell under the threshold. Every one of merko / bnana / h is
 * unmistakably Hindi; none were in the list.
 */
const HINGLISH_MARKERS = new RegExp(
  '\\b('
  + 'hai|hain|hei|h|hu|hun|hoon|ho|tha|thi|the|'
  + 'nahi|nhi|na|mat|'
  + 'karna|krna|karvana|krvana|karani|karwana|kar|kr|kro|karo|karu|karun|kru|'
  + 'kaise|kese|kya|kyu|kyun|kab|kahan|kaha|kaun|kaunsi|konsi|'
  + 'mera|meri|mere|merko|mujhe|mujhko|mko|apna|apni|'
  + 'koi|kuch|sab|bahut|bhot|bohot|jyada|zyada|thoda|'
  + 'raha|rahi|rahe|rha|rhi|rhe|gaya|gayi|gye|jata|jati|'
  + 'liye|lie|ke|ki|ka|ko|me|mein|par|pe|se|aur|ya|to|toh|bhi|'
  + 'jaise|chahiye|chaiye|batao|bta|btao|bataye|bataiye|'
  + 'banana|bnana|banna|bnna|hona|hone|dena|lena|milna|'
  + 'accha|acha|theek|thik|sahi|galat|dikkat|samasya|pareshan|problem'
  + ')\\b', 'gi',
);

function detectLanguage(text) {
  if (DEVANAGARI.test(text)) return 'hi';
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'en';
  const markers = (text.match(HINGLISH_MARKERS) || []).length;
  // Two markers, or a fifth of the sentence. With the abbreviations above, a
  // genuinely English sentence still rarely trips two.
  return markers >= 2 || markers / words.length > 0.2 ? 'hinglish' : 'en';
}

/* ── safety ───────────────────────────────────────────────────────────── */

/**
 * Crisis detection short-circuits the whole pipeline. This runs before intent,
 * before retrieval, before anything — a person saying they want to end their
 * life must not be answered with a puja recommendation and a pandit card.
 *
 * Deliberately broad and deliberately not clever. A false positive costs one
 * gentle message; a false negative is unconscionable.
 */
const CRISIS_PATTERNS = [
  /\b(suicide|suicidal|kill myself|end my life|end it all|self[- ]harm|hurt myself)\b/i,
  /\b(marna chahta|marna chahti|mar jau|mar jaun|jaan dena|jaan de du|khudkushi|atmahatya)\b/i,
  /\b(jeena nahi chahta|jeene ka mann nahi|zindagi khatam)\b/i,
  /आत्महत्या|खुदकुशी|मरना चाहता|जान दे/,
];

/** Domains where a promised outcome would be actively harmful. */
const SENSITIVE_PATTERNS = {
  medical: [/\b(cancer|tumou?r|kidney|heart attack|paralysis|hiv|surgery|operation|chemo)\b/i,
    /\b(bimari|bimar|ilaaj|dawai|doctor|hospital|operation)\b/i, /कैंसर|बीमारी|इलाज|अस्पताल/],
  legal: [/\b(court|case|fir|bail|lawsuit|police|jail)\b/i, /\b(mukadma|adalat|tarikh|jamanat)\b/i, /अदालत|मुकदमा|जमानत/],
  financial: [/\b(loan|debt|bankrupt|emi|karza|udhaar)\b/i, /कर्ज|दिवालिया/],
};

function safetyCheck(text) {
  if (CRISIS_PATTERNS.some((re) => re.test(text))) {
    return { crisis: true, sensitive: [] };
  }
  const sensitive = Object.entries(SENSITIVE_PATTERNS)
    .filter(([, pats]) => pats.some((re) => re.test(text)))
    .map(([domain]) => domain);
  return { crisis: false, sensitive };
}

/* ── entity extraction ────────────────────────────────────────────────── */

/** Normalise for matching: lowercase, strip punctuation, collapse spaces. */
const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/**
 * Hinglish filler. Present in almost every sentence a devotee types, so it
 * carries no information about WHICH problem they have.
 *
 * Without this the category pre-filter below scored on grammar rather than
 * meaning, and picked the wrong category on ordinary input. Measured on
 * production, "mere business me kaam acha nahi chal raha loss ho raha hai":
 *
 *   santan-issues  "Bachha nahi ho raha hai"             bachha✗ nahi✓ raha✓  = 0.67  ← won
 *   business-loss  "Business mein bahut loss ho raha hai" business✓ mein✗ bahut✗ loss✓ raha✓ = 0.60
 *
 * A business query was classified santan-issues — two of santan's three
 * scoring words were "nahi" and "raha". Short example phrases are the most
 * affected, because one filler word is a third of their score.
 */
const HINGLISH_STOPWORDS = new Set([
  'nahi', 'nhi', 'raha', 'rahi', 'rahe', 'hota', 'hoti', 'hote', 'jata', 'jati', 'jate',
  'hain', 'hai', 'mein', 'mera', 'meri', 'mere', 'apna', 'apni', 'koi', 'kuch', 'bahut',
  'bilkul', 'hamesha', 'aksar', 'roz', 'karna', 'karne', 'karta', 'karti', 'liye', 'wala',
  'wali', 'kar', 'kya', 'kaise', 'phir', 'fir', 'lekin', 'par', 'aur', 'toh', 'bhi', 'mujhe',
  'humein', 'hume', 'aata', 'aati', 'aate', 'gaya', 'gayi', 'gaye', 'diya', 'lagta', 'lagti',
]);

/**
 * The words in an example phrase that actually identify a problem.
 *
 * Whole words, not substrings — the old `hay.includes(w)` matched "raha"
 * inside "rahasya" and any short word inside a longer one, on top of the
 * filler problem above. `containsPhrase` already applies the same rule for
 * temple and city names.
 */
function phraseSignal(phrase) {
  return norm(phrase).split(' ').filter((w) => w.length > 3 && !HINGLISH_STOPWORDS.has(w));
}

/**
 * Whole-word containment. Substring matching would match "Datia" inside
 * "Datiana" and, worse, match a two-letter city name inside half the corpus.
 */
function containsPhrase(haystack, phrase) {
  const p = norm(phrase);
  if (!p || p.length < 3) return false;
  return new RegExp(`(^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(haystack);
}

/** Longest match wins: "Maa Baglamukhi Temple Nalkheda" beats "Nalkheda". */
function bestMatch(haystack, candidates, getText) {
  let best = null;
  for (const c of candidates || []) {
    const text = getText(c);
    if (text && containsPhrase(haystack, text) && (!best || text.length > getText(best).length)) {
      best = c;
    }
  }
  return best;
}

/**
 * A message that is ONLY a greeting.
 *
 * "hello" used to run the full pipeline: nothing was retrieved, confidence
 * came back low, and the clarification gate answered a hello with "Could you
 * tell me a little more about what has been happening?" — which reads as though
 * the assistant thinks something is wrong before the devotee has said anything.
 *
 * Anchored to the WHOLE message, so "namaste, business me dikkat hai" is a
 * problem description that happens to open politely, not a greeting.
 */
const GREETING_ONLY = new RegExp(
  '^\\s*(?:'
  + 'hi|hey+|hello+|helo|yo|'
  + 'namaste|namaskar|namaskaram|pranam|pranaam|'
  + 'ram ram|jai shree ram|jai shri ram|jai sri ram|jai mata di|jai maa|'
  + 'jai baglamukhi|har har mahadev|radhe radhe|jai jinendra|'
  + 'good (?:morning|afternoon|evening)|'
  + 'salaam|assalam(?:u)? ?alaikum'
  + ')'
  + '(?:\\s+(?:ji|sir|madam|bhai|guru ?ji|pandit ?ji|there))*'
  + '[\\s!.,\u0964]*$',
  'i',
);

function isGreetingOnly(text) {
  const t = String(text || '').trim();
  // A long message is never "just hello", whatever it starts with.
  return t.length > 0 && t.length <= 40 && GREETING_ONLY.test(t);
}

/**
 * An Indic greeting is itself the language signal.
 *
 * detectLanguage() counts Hinglish marker words, and "jai mata di" contains
 * none of them — so a devotee opening with "namaste" or "radhe radhe" was
 * greeted back in English. Two or three words carry no grammar to detect, but
 * the choice of greeting is unambiguous on its own.
 */
const INDIC_GREETING = new RegExp(
  '^\\s*(?:namaste|namaskar|namaskaram|pranam|pranaam|ram ram|jai |har har mahadev'
  + '|radhe radhe|jai jinendra|salaam|assalam)', 'i',
);

const SERVICE_TYPE_PATTERNS = [
  [/\b(havan|hawan|homa|yagya|yagna|yajna)\b|हवन|यज्ञ/i, 'havan'],
  [/\b(anushthan|anusthan|sadhana)\b|अनुष्ठान/i, 'anushthan'],
  [/\b(jaap|jap|paath|path|stotra)\b|जाप|पाठ/i, 'jaap'],
  [/\b(puja|pooja|pujan|poojan|abhishek)\b|पूजा|अभिषेक/i, 'puja'],
];

/**
 * "Show me who can do this" — an explicit request for the cards.
 *
 * When someone types "best pandit ji suggest kro" they have already decided.
 * Answering with "shall I suggest a pandit?" would be the same insult as
 * re-asking a question they just answered.
 */
const WANTS_RECOMMENDATIONS = new RegExp(
  '\\b('
  + 'pandit|panditji|pujari|acharya|'
  + 'suggest|recommend|batao|bta|btao|bataiye|dikhao|dikha|'
  /*
   * 'acha'/'accha' used to be listed here, for "koi acha pandit batao". It is
   * also the most ordinary adjective in the language, so it fired on plain
   * problem descriptions: "mere business me kaam ACHA nahi chal raha loss ho
   * raha hai" was read as an explicit request for pandit cards, which skipped
   * the offer step entirely and pushed cards at someone who had just described
   * a loss. A real request for a good pandit still matches on 'pandit',
   * 'batao', 'suggest' or 'dikhao' in the same sentence.
   */
  + 'kaun|kon|kaunsa|konsa|kaunse|konse|best|'
  + 'seva|service|puja karvana|havan karvana|karvana hai|contact'
  + ')\\b|पंडित|सुझाव|बताइये|बताओ', 'i',
);

/**
 * A plain yes.
 *
 * Deliberately narrow: a longer sentence is a new question, not an answer to
 * the offer, and treating it as consent would show cards for the wrong thing.
 */
const AFFIRMATIVE = new RegExp(
  '^\\s*('
  + 'ha|haa|haan|han|haanji|ji|ji haan|yes|yeah|yep|ok|okay|okey|theek|thik|sure|'
  + 'kro|karo|kar do|kardo|dikhao|batao|bta do|suggest karo|suggest kro|'
  + 'zaroor|jarur|bilkul|please|plz'
  + ')[\\s!.।]*$|^\\s*(हाँ|हां|जी|ठीक|बिल्कुल|ज़रूर)[\\s!।]*$', 'i',
);

/**
 * Individual words that only ever mean "yes" or reinforce one — never a word
 * that could carry NEW information on its own.
 *
 * AFFIRMATIVE above requires the whole message to be one exact listed phrase,
 * so "ha please karo" (three words, each individually a yes/filler word) was
 * falling through as a non-answer and re-triggering the same offer instead of
 * showing cards — the app looked like it wasn't listening. isPureAffirmative()
 * below covers that: every word in a short reply must be one of these, which
 * still rejects a genuinely different follow-up ("haan lekin pehle ye batao
 * ki kitna kharcha aayega" has real content words — lekin, kharcha — that
 * aren't in this set) the same way the ai-ranking.test.js case already
 * expects.
 */
const AFFIRMATIVE_WORDS = new Set([
  'ha', 'haa', 'haan', 'han', 'haanji', 'ji', 'yes', 'yeah', 'yep', 'ok', 'okay', 'okey',
  'theek', 'thik', 'sure', 'hai', 'kro', 'karo', 'kar', 'kardo', 'do', 'dikhao', 'batao', 'bta',
  'suggest', 'zaroor', 'jarur', 'bilkul', 'please', 'plz',
  'हाँ', 'हां', 'जी', 'ठीक', 'बिल्कुल', 'ज़रूर',
]);

/** A reply made up entirely of AFFIRMATIVE_WORDS (max 6, so a real sentence
 *  can never slip through) — the "several reinforcing words" case AFFIRMATIVE
 *  alone doesn't catch. Empty/overlong messages are never affirmative. */
function isPureAffirmative(message) {
  const trimmed = (message || '').trim();
  if (!trimmed) return false;
  if (AFFIRMATIVE.test(trimmed)) return true;
  const words = trimmed.toLowerCase().replace(/[!.।,?]/g, '').split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 6) return false;
  return words.every((w) => AFFIRMATIVE_WORDS.has(w));
}

const ONLINE_PATTERNS = /\b(online|video call|ghar baithe|ghar se|remote|virtual)\b|ऑनलाइन|घर बैठे/i;
const TEMPLE_VISIT_PATTERNS = /\b(mandir me|mandir mein|temple me|temple mein|darshan|jaakar|jakar)\b|मंदिर में|दर्शन/i;

/**
 * An explicit request must not be second-guessed.
 *
 * When someone writes "Nalkheda me hi havan karvana hai", the "hi" is doing
 * real work — it means *only there*. Treating that as one signal among many and
 * offering Datia first is the single most annoying failure this system could
 * have.
 */
const EXPLICIT_MARKERS = /\b(hi|only|sirf|specifically|zaroor)\b/i;

/**
 * Words that describe the ASK but not the PROBLEM.
 *
 * "Koi puja batao" is made entirely of these — the person has told us they want
 * a ritual and nothing about why, which is precisely the case the spec says to
 * ask about. Contrast "ghar me kalesh": short, but "ghar" and "kalesh" are real
 * content and retrieval can work with them.
 */
const FILLER = new Set([
  'koi', 'kuch', 'kaunsi', 'kaunsa', 'konsi', 'konsa', 'kya', 'kaise', 'batao', 'bataye',
  'bataiye', 'suggest', 'karo', 'kro', 'karna', 'karvana', 'karani', 'karwana', 'chahiye',
  'hai', 'hain', 'ho', 'mujhe', 'mera', 'meri', 'mere', 'me', 'mein', 'ke', 'ki', 'ka',
  'liye', 'aur', 'ya', 'to', 'toh', 'please', 'want', 'need', 'a', 'an', 'the', 'for',
  'i', 'my', 'me', 'some', 'any', 'which', 'what', 'tell', 'puja', 'pooja', 'havan',
  'hawan', 'anushthan', 'jaap', 'ritual', 'pandit', 'ji',
  'should', 'do', 'get', 'done', 'perform', 'recommend', 'advise', 'is', 'are', 'can',
  'you', 'us', 'we', 'best', 'good', 'right', 'about', 'help',
]);

/**
 * Vague = the message names no problem, no deity and no temple, and every word
 * left after removing filler is gone. A word count alone got this wrong: "koi
 * puja batao" is three words and completely vague, while "ghar me kalesh" is
 * three words and perfectly actionable.
 */
function isVague(hay, { temple, deity, problemCategory }) {
  if (temple || deity || problemCategory) return false;
  const content = hay.split(' ').filter((w) => w && w.length > 1 && !FILLER.has(w));
  return content.length === 0;
}

/**
 * Extract structured intent. Pure.
 *
 * @param {string} text
 * @param {object} vocab
 * @param {Array}  vocab.temples     [{ id, name, city, state, slug }]
 * @param {Array}  vocab.cities      ['Nalkheda', 'Ujjain', ...]
 * @param {Array}  vocab.states      ['Madhya Pradesh', ...]
 * @param {Array}  vocab.deities     ['Maa Baglamukhi', ...]
 * @param {Array}  vocab.categories  [{ slug, examplePhrases: [] }]
 * @param {object} memory            slots carried from earlier turns
 */
function extractIntent(text, vocab = {}, memory = {}) {
  const raw = (text || '').trim();
  const hay = norm(raw);
  // An Indic greeting overrides the marker count — see INDIC_GREETING.
  const language = INDIC_GREETING.test(raw) ? 'hinglish' : detectLanguage(raw);
  const safety = safetyCheck(raw);

  const temple = bestMatch(hay, vocab.temples, (t) => t.name);
  const city = temple?.city
    || bestMatch(hay, vocab.cities, (c) => c)
    || null;
  const state = temple?.state || bestMatch(hay, vocab.states, (s) => s) || null;
  const deity = bestMatch(hay, vocab.deities, (d) => d) || null;

  const serviceType = (SERVICE_TYPE_PATTERNS.find(([re]) => re.test(raw)) || [])[1] || null;

  /* Category guess from the taxonomy's own example phrases. This is a cheap
     pre-filter, not the answer — retrieval decides. But when someone types a
     phrase almost verbatim from the KB it is worth a strong metadata boost. */
  const hayWords = new Set(hay.split(' '));
  let problemCategory = null;
  let bestOverlap = 0;
  let bestSpecificity = 0;
  for (const cat of vocab.categories || []) {
    for (const phrase of cat.examplePhrases || []) {
      const words = phraseSignal(phrase);
      if (!words.length) continue;
      const matched = words.filter((w) => hayWords.has(w));
      const hits = matched.length / words.length;
      if (hits < 0.5) continue;
      /*
       * Ties are common and were being broken by whatever order the rows came
       * back in. "ghar me kalesh h" matched ghar-mein-kalesh's "Roz kalesh
       * rehta hai" (kalesh of kalesh+rehta) and family-illness's own phrase at
       * exactly 0.5 each, and family-illness won — so a household-conflict
       * question was answered about recurring illness, and matched to the
       * services for it.
       *
       * Broken on total matched characters: the longer word is the more
       * distinctive one. "kalesh" (6) beats "ghar" (4), which is the right
       * answer and the reason the tie existed at all.
       */
      const specificity = matched.reduce((n, w) => n + w.length, 0);
      if (hits > bestOverlap || (hits === bestOverlap && specificity > bestSpecificity)) {
        bestOverlap = hits;
        bestSpecificity = specificity;
        problemCategory = cat.slug;
      }
    }
  }

  const wantsOnline = ONLINE_PATTERNS.test(raw);
  const wantsTemple = !wantsOnline && (TEMPLE_VISIT_PATTERNS.test(raw) || Boolean(temple));

  const intent = {
    language,
    raw,
    // Explicit only when the user actually named it in THIS message. A temple
    // remembered from an earlier turn is context, not a fresh instruction.
    temple: temple?.name || null,
    templeId: temple?.id || null,
    city,
    state,
    deity,
    serviceType,
    problemCategory,
    categoryConfidence: bestOverlap,
    wantsOnline,
    wantsTemplePuja: wantsTemple,
    isExplicitRequest: Boolean(temple || (deity && serviceType)),
    isLockedToTemple: Boolean(temple) && EXPLICIT_MARKERS.test(raw),
    crisis: safety.crisis,
    sensitiveDomains: safety.sensitive,
    isVague: isVague(hay, { temple, deity, problemCategory }),
    // Asked for a pandit / seva outright — show the cards, do not offer to.
    wantsRecommendations: WANTS_RECOMMENDATIONS.test(raw),
    // A bare "haan" — or several reinforcing words like "ha please karo" —
    // answering our offer.
    isAffirmative: isPureAffirmative(raw),
    isGreeting: isGreetingOnly(raw),
  };

  return mergeMemory(intent, memory);
}

/**
 * Carry forward what was already established.
 *
 * "Nalkheda" in turn 3 must resolve against the business puja from turn 1, so
 * a slot the current message did not mention falls back to memory. The reverse
 * never happens: a fresh explicit value always wins, because the user changing
 * their mind is exactly what a new message means.
 */
function mergeMemory(intent, memory = {}) {
  const carried = {};
  for (const slot of ['problemCategory', 'city', 'state', 'deity', 'serviceType', 'temple', 'templeId']) {
    if (intent[slot] == null && memory[slot] != null) {
      carried[slot] = memory[slot];
    }
  }
  return { ...intent, ...carried, carriedFromMemory: Object.keys(carried) };
}

/** Slots worth persisting to ai_conversations.memory after a turn. */
function toMemory(intent, extra = {}) {
  const out = {};
  for (const slot of ['problemCategory', 'city', 'state', 'deity', 'serviceType', 'temple', 'templeId', 'language']) {
    if (intent[slot] != null) out[slot] = intent[slot];
  }
  /*
   * The devotee's own longest description of the problem, carried forward so a
   * two-word follow-up ("career ke liye") is still searched against something
   * substantial. Kept only when it is genuinely a description — a bare
   * "haan" or "Nalkheda" is context, not a problem statement.
   */
  if (intent.raw) {
    const content = norm(intent.raw).split(' ').filter((w) => w.length > 2 && !FILLER.has(w));
    if (content.length >= 3) out.lastProblemText = intent.raw.slice(0, 300);
  }
  return { ...out, ...extra };
}

/**
 * Decide whether to ask instead of answering.
 *
 * Ask ONCE, then commit. This is the rule that matters most for how the
 * assistant feels, and it was missing entirely — every turn re-evaluated from
 * scratch, so a real conversation went:
 *
 *   "koi best pandit ji suggest kro"  -> "aap kis cheez ke liye?"
 *   "career ke liye"                  -> "thoda aur bataiye"
 *   "merko business me career bnana"  -> "tell me a little more"
 *   "kam nhi ban rhe h"               -> "thoda aur bataiye"
 *
 * The devotee answered every single time and was asked again. Nobody stays for
 * a fifth. A half-confident recommendation the person can reject beats an
 * interrogation they walk away from — so after one question we work with
 * whatever we have.
 *
 * @param {object} opts
 * @param {boolean} opts.alreadyAsked  a clarifying question was asked earlier
 *                                     in this conversation
 * @param {boolean} opts.hasContext    memory already holds a problem category,
 *                                     temple or deity — enough to search on
 */
function needsClarification(intent, retrieval, opts = {}) {
  if (intent.crisis) return null;                    // handled separately
  if (intent.isExplicitRequest) return null;          // never interrogate a clear request

  /*
   * A plain "haan" is an ANSWER, not a new question. It is one word, so the
   * vagueness rule would otherwise class it as vague and ask "what is this
   * for?" — of someone who just said yes to being shown pandits.
   */
  if (intent.isAffirmative) return null;

  /*
   * "best pandit ji suggest kro" tells us exactly what they want. But "koi puja
   * batao" also contains "batao" while saying nothing about the problem — so an
   * outright request only skips the question when there is actually something
   * to act on. Without the `!isVague` guard this silently disabled the
   * clarifying question for the one case it exists to serve.
   */
  if (intent.wantsRecommendations && !intent.isVague) return null;

  // Asked once already — proceed with best effort, whatever the confidence.
  if (opts.alreadyAsked) return null;

  /*
   * The conversation has already established what this is about — a temple, a
   * deity or a problem category is in memory. Work with it.
   *
   * This applies even to a vague-looking message: "koi best pandit ji suggest
   * kro" right after "Maa Baglamukhi mandir me puja karvana hai" is not vague
   * at all in context. It means "pandits, at that temple". Asking "what is
   * this for?" there is asking the devotee to repeat themselves.
   */
  if (opts.hasContext) return null;

  if (intent.isVague) {
    return intent.language === 'en'
      ? 'What is this for — business, career, health, marriage, family peace, or something else?'
      : 'Aap kis cheez ke liye puja dekh rahe hain — business, career, health, vivah, ghar ki shanti, ya koi aur samasya?';
  }

  /*
   * The taxonomy already recognised this problem, so there is nothing to ask.
   *
   * The confidence gate below is a RETRIEVAL score, and retrieval scores badly
   * on the short SMS-style Hinglish people actually type — "ghar me kalesh h",
   * "job nhi lg rhi", "shadi nhi hori" were every one of them answered with
   * "Thoda aur bataiye" while the category pre-filter had already matched them
   * to ghar-mein-kalesh, job-problems and marriage-delays against the
   * taxonomy's own example phrases. Asking someone to restate a problem the
   * system has already identified is the loop this function exists to prevent.
   *
   * Safe because the pre-filter now scores on meaning rather than grammar:
   * Hinglish filler is stripped before the overlap is computed, so "pata nahi
   * kya ho raha hai" still matches nothing at all.
   */
  if (intent.problemCategory) return null;

  if (retrieval && !retrieval.shouldRecommend) {
    return intent.language === 'en'
      ? 'Could you tell me a little more about what has been happening?'
      : 'Thoda aur bataiye — kya ho raha hai aapke saath?';
  }

  return null;
}

/**
 * The text to actually search on.
 *
 * A reply like "career ke liye" is two words — a hopeless retrieval query on
 * its own, even though the conversation had already established a temple and
 * that the devotee wants a pandit. Retrieval was being handed only the latest
 * message, so each short answer scored badly and triggered yet another
 * question, which produced another short answer. That is the loop.
 *
 * Short follow-ups are therefore searched together with what came before.
 */
function searchText(message, memory = {}) {
  const contentWords = norm(message).split(' ').filter((w) => w.length > 2 && !FILLER.has(w));
  if (contentWords.length >= 4) return message;      // substantial on its own

  const carried = [memory.lastProblemText, memory.problemCategory, memory.temple]
    .filter(Boolean)
    .join(' ');
  return carried ? `${carried} ${message}` : message;
}

module.exports = {
  isGreetingOnly,
  extractIntent,
  detectLanguage,
  safetyCheck,
  mergeMemory,
  toMemory,
  needsClarification,
  searchText,
  // exported for tests
  containsPhrase,
  bestMatch,
  isVague,
};
