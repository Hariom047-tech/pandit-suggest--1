/**
 * The catalog of admin-managed page images ("slots").
 *
 * Every non-content image on the public pages — page heroes, the trust
 * section's circular portrait, the two CSS backdrops on the homepage, the
 * category tiles and the tile fallbacks — used to be a URL typed into a
 * .tsx or .css file. Changing one meant a code change, a rebuild and a
 * deploy, and the files themselves lived wherever the person who added them
 * happened to put them (some on the web server's own disk under
 * public/assets, some hand-copied into an S3 `static/` prefix nobody
 * administers).
 *
 * A slot is a stable key with an image behind it. Admins upload through
 * Admin Panel -> Page Images; the file goes to S3 exactly like every other
 * upload (services/media/mediaStorage.js), and the public page reads the URL
 * from GET /api/site-images. Nothing is written to the server's disk.
 *
 * This list is the contract shared by three places: the admin UI renders it
 * as the set of editable slots, the upload route validates `:slotKey`
 * against it, and the frontend's DEFAULTS map (frontend/app/src/lib/
 * siteImages.ts) mirrors the keys. Adding a slot means adding it here and
 * to that map — never inventing a key at the call site.
 */

const SITE_IMAGE_SLOTS = [
  {
    group: 'Home page',
    slots: [
      {
        key: 'home.trust',
        label: 'Trust section portrait',
        hint: 'The circular image beside "Because some prayers deserve more than a stranger". Square crop, 420×420 or larger.',
      },
      {
        key: 'home.epuja_bg',
        label: 'Online puja illustration',
        hint: 'Background illustration of the "Online Puja" band.',
      },
      {
        key: 'home.reviews_bg',
        label: 'Testimonials backdrop',
        hint: 'Background behind the reviews carousel. Wide crop; it is heavily dimmed, so detail is lost by design.',
      },
    ],
  },
  {
    group: 'Directory pages',
    slots: [
      {
        key: 'pandits.hero',
        label: 'Pandits page hero',
        hint: 'Circular hero image on /pandits.',
      },
      {
        key: 'temples.hero',
        label: 'Temples page hero',
        hint: 'Circular hero image on /temples.',
      },
      {
        key: 'services.hero',
        label: 'Services page hero',
        hint: 'Circular hero image on /services.',
      },
    ],
  },
  {
    group: 'Service tiles',
    slots: [
      {
        key: 'services.cat_life',
        label: 'Category — Life events',
        hint: 'Shown only until the category itself has an image set in Services -> Categories.',
      },
      { key: 'services.cat_daily', label: 'Category — Daily pujas', hint: 'Category tile fallback.' },
      { key: 'services.cat_festival', label: 'Category — Festivals', hint: 'Category tile fallback.' },
      { key: 'services.cat_shanti', label: 'Category — Shanti & dosh', hint: 'Category tile fallback.' },
      {
        key: 'services.fallback_puja',
        label: 'Service tile fallback — puja',
        hint: 'Used for any service with no image of its own.',
      },
      {
        key: 'services.fallback_havan',
        label: 'Service tile fallback — havan',
        hint: 'Used for havan services with no image of their own.',
      },
    ],
  },
];

/** Flat [{ key, label, hint, group }] — the order the admin page renders in. */
const SLOT_LIST = SITE_IMAGE_SLOTS.flatMap(
  ({ group, slots }) => slots.map((s) => ({ ...s, group })),
);

const SLOT_KEYS = new Set(SLOT_LIST.map((s) => s.key));

const isValidSlot = (key) => SLOT_KEYS.has(key);

module.exports = { SITE_IMAGE_SLOTS, SLOT_LIST, isValidSlot };
