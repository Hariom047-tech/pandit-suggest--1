const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const repo = require('../repositories/auth.repository');
const { hashToken } = require('../middleware/auth');
const { withUserContext } = require('../config/db');
const { logSecurityEvent } = require('../utils/securityLog');
const { sessionTtlHours, nodeEnv } = require('../config/env');
const { logActivityEvent, deviceTypeFromUserAgent } = require('../utils/activityLog');
const { browsingMarketFor, viewerLocationSnapshot } = require('../services/distribution/market');
const hyperSender = require('../services/notifications/hyperSender');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;

/** users.full_name is NOT NULL, but a WhatsApp-OTP signup has nothing to put
 *  in it — the number is all we know at that moment. This stands in until
 *  the client collects a real name (see phoneLogin's `needsName`), and is the
 *  marker for "we still haven't asked". Keep in sync with Login.tsx. */
const NAME_PLACEHOLDER = 'Devotee';

/**
 * Allow-list, not a deny-list.
 *
 * This used to strip a couple of known-sensitive columns and return the rest,
 * which meant every future column on `users` was published by default — and
 * `date_of_birth` (the second factor in pandit password reset) was exactly
 * such a column. Enumerating what MAY leave the server fails closed instead.
 */
const PUBLIC_USER_FIELDS = [
  'id', 'email', 'phone', 'full_name', 'display_name', 'avatar_url',
  'role', 'status', 'city', 'state', 'pincode',
  'preferred_language', 'theme_preference',
  'email_verified', 'phone_verified', 'last_login_at', 'created_at',
];

function sanitize(user) {
  if (!user) return null;
  const out = {};
  for (const key of PUBLIC_USER_FIELDS) {
    if (key in user) out[key] = user[key];
  }
  return out;
}

/** `extra` is merged into the response body — used by phoneLogin to tell the
 *  client it just CREATED this account, so the UI can ask for a real name
 *  instead of leaving the 'Devotee' placeholder on screen forever. */
async function issueSession(res, user, req, extra) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);
  await repo.createSession({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
    ip: req.ip,
    deviceInfo: { userAgent: req.headers['user-agent'] || null },
  });
  await withUserContext(user.id, (q) => repo.touchLogin(user.id, q));

  // Where the edge says this login came from, refreshed every time. It lands
  // in users.geo_* — never in users.city/state/country, which belong to the
  // devotee and are theirs to write (see migrations/0007). Best-effort and
  // deliberately not awaited: a login must not fail because a nice-to-have
  // analytics column could not be updated.
  const viewer = viewerLocationSnapshot(req.headers);
  void withUserContext(user.id, (q) => repo.updateLoginGeo(user.id, viewer, q))
    .catch((err) => console.error('[auth] could not record login geo:', err.message));

  const browsing = browsingMarketFor(req);
  void logActivityEvent({
    userId: user.id,
    eventType: 'LOGIN',
    country: browsing.countryCode,
    market: browsing.market === 'UNKNOWN' ? null : browsing.market,
    locationSource: browsing.source,
    deviceType: deviceTypeFromUserAgent(req.headers['user-agent']),
  });

  res.status(201).json({ token, expiresAt, user: sanitize(user), ...extra });
}

/** POST /api/auth/register — plain devotee/temple_admin accounts. Pandits
 *  register via POST /api/auth/register-pandit (needs a linked pandits row). */
async function register(req, res) {
  const { email, password, fullName, phone, role } = req.body || {};
  if (!email || !password || !fullName) return res.status(400).json({ error: 'email, password and fullName are required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'email is not valid' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  if (role && !['devotee', 'temple_admin'].includes(role)) return res.status(400).json({ error: 'role must be devotee or temple_admin' });

  if (await repo.findByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await repo.create({ email, phone, passwordHash, fullName, role });
  await issueSession(res, user, req);
}

/** POST /api/auth/register-pandit — creates the users row AND the pandits
 *  profile row it must have, in one transaction. `slug` becomes the public
 *  profile URL (/api/pandits/:slug) so it must be unique and url-safe. */
async function registerPandit(req, res) {
  const { email, password, fullName, phone, slug } = req.body || {};
  if (!email || !password || !fullName || !slug) {
    return res.status(400).json({ error: 'email, password, fullName and slug are required' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'email is not valid' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'slug must be lowercase letters, numbers and hyphens only' });

  if (await repo.findByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const { user } = await repo.createPandit({ email, phone, passwordHash, fullName, slug });
    await issueSession(res, user, req);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That profile slug is already taken' });
    throw err;
  }
}

/** POST /api/auth/login */
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = await repo.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    // Awaited deliberately, unlike the rate-limit handler in
    // middleware/security.js: a failed login is low-frequency and already
    // slow (bcrypt), so the audit trail being complete before responding is
    // worth more here than shaving a few ms off an already-401 response.
    await logSecurityEvent('LOGIN_FAILED', req, { email });
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.status === 'suspended' || user.status === 'banned' || user.status === 'deactivated') {
    return res.status(403).json({ error: `Account is ${user.status}` });
  }
  await issueSession(res, user, req);
}

/** POST /api/auth/logout */
async function logout(req, res) {
  const [, token] = (req.headers.authorization || '').split(' ');
  if (token) await repo.revokeSession(hashToken(token));
  if (req.user?.id) void logActivityEvent({ userId: req.user.id, eventType: 'LOGOUT' });
  res.json({ ok: true });
}

/** GET /api/auth/me */
async function me(req, res) {
  const user = await withUserContext(req.user.id, (q) => repo.findById(req.user.id, q));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(sanitize(user));
}

/** PATCH /api/auth/me — allow-listed profile update (name, phone, email,
 *  city, state). The client never touches role, status, or any verified flag:
 *  email_verified below is derived here, never read from the request body. */
async function updateMe(req, res) {
  const { full_name, phone, email, city, state } = req.body || {};
  const updates = {};
  if (full_name !== undefined) {
    const name = String(full_name).trim().slice(0, 120);
    // full_name is NOT NULL and is what the whole UI greets them by — an
    // empty string would just replace 'Devotee' with a blank header.
    if (!name) return res.status(400).json({ error: 'Please enter your name' });
    updates.full_name = name;
  }

  // The devotee's own town. Until now only an admin could set these, so every
  // account fell back to the CloudFront guess in the admin Users list — and
  // that guess resolves a mobile connection to the carrier's gateway city, not
  // the person's village. Someone in a town outside Indore shows up as Indore
  // and no amount of edge data will fix it; only they can say where they are.
  // Empty string means "clear it", which puts them back on the geo fallback.
  if (city !== undefined) updates.city = city ? String(city).trim().slice(0, 120) : null;
  if (state !== undefined) updates.state = state ? String(state).trim().slice(0, 120) : null;
  // Fetched once for both branches below: each has to compare the incoming
  // value against what is already stored before deciding whether a verified
  // flag survives, and two reads of the same row inside one request would only
  // invite them to disagree.
  let current = null;
  if (phone !== undefined || email !== undefined) {
    current = await withUserContext(req.user.id, (q) => repo.findById(req.user.id, q));
    if (!current) return res.status(404).json({ error: 'User not found' });
  }

  if (phone !== undefined) {
    const next = phone ? String(phone).trim().slice(0, 20) : null;

    // Same shape as the email branch below, and for the same reason. Typing a
    // number into a form is not proof of owning it, so a changed number must
    // lose phone_verified — otherwise an account that verified one number by
    // OTP could carry the flag over to any other number just by saving the
    // profile, and record_qualified_lead() (which gates every lead on
    // phone_verified) would hand the pandit a number nobody owns.
    // Re-saving the SAME number must not clear the flag, or a devotee who
    // edits their name would silently lose their verification.
    if (next !== current.phone) {
      if (next) {
        const taken = await repo.findByPhone(next);
        if (taken && taken.id !== req.user.id) {
          return res.status(409).json({ error: 'That phone number is already used by another account' });
        }
      }
      updates.phone = next;
      updates.phone_verified = false;
    }
  }

  if (email !== undefined) {
    const next = email ? String(email).trim().toLowerCase().slice(0, 255) : null;
    if (next && !EMAIL_RE.test(next)) return res.status(400).json({ error: 'email is not valid' });

    // Re-saving the same address must not clear email_verified — otherwise a
    // Google user who edits their phone number and hits Save would silently
    // lose the verified flag Google earned them.
    if (next !== current.email) {
      if (next) {
        const taken = await repo.findByEmail(next);
        if (taken && taken.id !== req.user.id) {
          return res.status(409).json({ error: 'That email is already used by another account' });
        }
      }
      updates.email = next;
      // A self-declared address is NOT proof of ownership. Only Google
      // sign-in (googleAuth/linkGoogleId) may set this true.
      updates.email_verified = false;
    }
  }

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  try {
    await withUserContext(req.user.id, (q) => q(
      `UPDATE users SET ${ Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ') } WHERE id = $1`,
      [req.user.id, ...Object.values(updates)],
    ));
  } catch (err) {
    // UNIQUE(email)/UNIQUE(phone) losing the race against the check above.
    if (err.code === '23505') return res.status(409).json({ error: 'That email or phone is already used by another account' });
    throw err;
  }
  const updated = await withUserContext(req.user.id, (q) => repo.findById(req.user.id, q));
  res.json(sanitize(updated));
}

/** Set only for local/test environments (docker-compose.override.yml) —
 *  never in docker-compose.yml's production `backend` service, and never on
 *  any real deployment. When set, this exact code is accepted as correct for
 *  ANY pending OTP, in addition to the real generated one. This is a
 *  deliberately blunt bypass (not gated on NODE_ENV, unlike
 *  ALLOW_DEV_GEO_HEADER) because this codebase's own local Docker rig runs
 *  with NODE_ENV=production, which would otherwise make it impossible to
 *  turn on — see docs/PROJECT_STATUS.md. The env var itself being unset is
 *  the only gate, so it must never be set anywhere real accounts are created. */
function otpMatches(candidate, record) {
  const bypass = process.env.OTP_TEST_BYPASS_CODE;
  if (bypass && candidate === bypass) return true;
  const candidateHash = crypto.createHash('sha256').update(candidate).digest('hex');
  return candidateHash === record.otp_hash;
}

/** POST /api/auth/otp/request — a phone target is sent over WhatsApp via
 *  Hypersender (services/notifications/hyperSender.js); no email provider is
 *  wired up (see README "Known placeholders"). The OTP itself is always
 *  generated and stored locally — Hypersender is only ever the delivery
 *  channel, never the source of truth (see verifyOtp/phoneLogin's
 *  otpMatches below). In non-production the OTP is ALSO returned in the
 *  response body so the flow is still testable end-to-end without WhatsApp
 *  configured. 4 digits to match the OTP entry UI (Login.tsx's 4-box input).
 *
 *  Outside development, a phone OTP that cannot actually be delivered is an
 *  ERROR, not a 201 — see the comments inline. */
async function requestOtp(req, res) {
  const { target, targetType } = req.body || {};
  if (!target || !['phone', 'email'].includes(targetType)) {
    return res.status(400).json({ error: 'target and targetType ("phone" or "email") are required' });
  }
  const otp = String(crypto.randomInt(1000, 10000));
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiresMinutes = 10;
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
  await repo.createOtp({ target, targetType, otpHash, expiresAt });

  if (targetType === 'phone') {
    if (!hyperSender.isConfigured()) {
      // NOT a soft-fail any more. This branch means there is no delivery
      // channel at all: the code is generated and stored, and then nothing
      // sends it anywhere. Returning `ok: true` here made the UI say "OTP
      // sent to +91…" and left the user staring at an empty inbox — the
      // access log shows exactly that, one visitor requesting a code ten
      // times in twenty minutes and never being able to log in.
      //
      // In development the console log below is a real delivery channel, so
      // this only fires where there genuinely isn't one.
      if (nodeEnv !== 'development') {
        console.error('[auth] OTP requested but HYPERSENDER_INSTANCE_ID/HYPERSENDER_API_KEY are unset — nothing can deliver it');
        return res.status(503).json({ error: 'Phone verification is temporarily unavailable. Please try again later.' });
      }
    } else {
      const sent = await hyperSender.sendWhatsAppOtp(target, otp, expiresMinutes);
      if (!sent.ok) {
        // Same reasoning: an undelivered code is not a success. The OTP row
        // stays valid (harmless, and it still works if the message lands
        // late), but the caller is told to retry instead of waiting forever.
        console.error(`[auth] WhatsApp OTP delivery failed for ${target}: ${sent.error}`);
        // Except in development, where the console log below is still a
        // working channel and a provider outage shouldn't block local work.
        if (nodeEnv !== 'development') {
          return res.status(502).json({ error: 'Could not send the OTP right now. Please try again in a moment.' });
        }
      }
    }
  }

  if (nodeEnv === 'development') {
    // Dev-only: log OTP to console so local testing works without WhatsApp
    // configured. NEVER include in staging — use nodeEnv === 'development',
    // NOT !== 'production'.
    console.log(`[auth] OTP for ${targetType}:${target} = ${otp} (dev-only log)`);
  }
  res.status(201).json({ ok: true, expiresAt, ...(nodeEnv === 'development' ? { devOtp: otp } : {}) });
}

/** POST /api/auth/otp/verify — marks an already-known target verified. If
 *  the caller is logged in (req.user set), also flags their own
 *  email_verified/phone_verified. Does NOT create a session — for a
 *  passwordless phone login/signup that issues one, see phoneLogin below. */
async function verifyOtp(req, res) {
  const { target, targetType, otp } = req.body || {};
  if (!target || !targetType || !otp) return res.status(400).json({ error: 'target, targetType and otp are required' });

  const record = await repo.findLatestOtp(target, targetType);
  if (!record || record.verified) return res.status(400).json({ error: 'No pending OTP for this target' });
  if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'OTP has expired' });
  if (record.attempts >= record.max_attempts) return res.status(429).json({ error: 'Too many attempts — request a new OTP' });

  if (!otpMatches(otp, record)) {
    await repo.incrementOtpAttempts(record.id);
    return res.status(400).json({ error: 'Incorrect OTP' });
  }

  await repo.markOtpVerified(record.id);

  let outcome = null;
  if (req.user) {
    if (targetType === 'phone') {
      // Signing in on the phone with an OTP and later on the desktop with
      // Google leaves one person holding two accounts, and users.phone being
      // UNIQUE means the second one cannot record the number the first
      // already has. claim_verified_phone() (migrations/0005) resolves that:
      // it absorbs the other account when the phone is that account's ONLY
      // way in — which makes its owner, by definition, whoever just passed
      // this OTP — and refuses when the holder is separately reachable.
      //
      // The VALUE lands with the flag in there too, so the number on the row
      // is by construction the number an OTP was proved against. That is what
      // a pandit is shown when the lead arrives, and what updateMe's reset
      // above exists to protect.
      try {
        outcome = await repo.claimVerifiedPhone(target, req.user.id);
      } catch (err) {
        if (err.code === 'PS001') {
          return res.status(409).json({
            error: 'Yeh number ek aise account par hai jisme aap alag se login kar sakte hain. Us account me login karke try karein.',
          });
        }
        throw err;
      }
    } else {
      await withUserContext(req.user.id, (q) => repo.markTargetVerified(req.user.id, targetType, q));
    }
  }
  // `merged` is surfaced so the UI can say the old account was folded in,
  // rather than leaving the devotee to notice their history moved on its own.
  res.json({ ok: true, verified: true, merged: outcome === 'merged' });
}

/** POST /api/auth/otp/login — passwordless phone login/signup: verifies the
 *  OTP for `phone`, then finds-or-creates a devotee account for that number
 *  and issues a real session. `users.email` is NOT NULL + UNIQUE, so a
 *  brand-new phone-only account gets a synthetic placeholder email derived
 *  from the (already-UNIQUE) phone number — never shown to the user, never
 *  used to log in. */
async function phoneLogin(req, res) {
  const { phone, otp } = req.body || {};
  if (!phone || !otp) return res.status(400).json({ error: 'phone and otp are required' });

  const record = await repo.findLatestOtp(phone, 'phone');
  if (!record || record.verified) return res.status(400).json({ error: 'No pending OTP for this number — request a new one' });
  if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'OTP has expired' });
  if (record.attempts >= record.max_attempts) return res.status(429).json({ error: 'Too many attempts — request a new OTP' });

  if (!otpMatches(otp, record)) {
    await repo.incrementOtpAttempts(record.id);
    return res.status(400).json({ error: 'Incorrect OTP' });
  }
  await repo.markOtpVerified(record.id);

  let user = await repo.findByPhone(phone);
  let isNewUser = false;
  if (user) {
    if (!user.phone_verified) {
      await withUserContext(user.id, (q) => repo.markTargetVerified(user.id, 'phone', q));
      user.phone_verified = true;
    }
  } else {
    isNewUser = true;
    // No email at all — better than a fake `phone-xxx@otp...` placeholder
    // that looked like real data everywhere it was displayed (admin Users
    // list, the devotee's own profile). email is nullable for exactly this
    // (33-nullable-email-and-status-fix.sql); the UNIQUE constraint still
    // holds since Postgres allows any number of NULLs under it.
    try {
      user = await repo.create({ email: null, phone, fullName: NAME_PLACEHOLDER, role: 'devotee' });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'An account with this number already exists — please try again' });
      throw err;
    }
    await withUserContext(user.id, (q) => repo.markTargetVerified(user.id, 'phone', q));
    user.phone_verified = true;
  }

  if (user.status === 'suspended' || user.status === 'banned' || user.status === 'deactivated') {
    return res.status(403).json({ error: `Account is ${user.status}` });
  }
  // `isNewUser` drives Login.tsx's "what's your name?" step. NAME_PLACEHOLDER
  // is also flagged so accounts created before that step existed — every
  // phone signup so far, all of them still called 'Devotee' — get asked once
  // on their next login instead of being stuck with the placeholder.
  await issueSession(res, user, req, {
    isNewUser,
    needsName: isNewUser || user.full_name === NAME_PLACEHOLDER,
  });
}

/** POST /api/auth/google */
async function googleAuth(req, res) {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'Google credential is required' });

  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid Google token payload' });
    }

    const { sub: googleId, email, name: fullName } = payload;
    let user = await repo.findByEmail(email);

    if (user) {
      // If user exists but doesn't have google_id linked, link it.
      if (!user.google_id) {
        await withUserContext(user.id, (q) => repo.linkGoogleId(user.id, googleId, q));
        user.google_id = googleId;
      }
      // Always ensure email_verified=true for Google users (Google verifies emails).
      // Covers existing accounts created before this fix.
      if (!user.email_verified) {
        await withUserContext(user.id, (q) => q(
          'UPDATE users SET email_verified = TRUE WHERE id = $1', [user.id]
        ));
        user.email_verified = true;
      }
    } else {
      // User doesn't exist, create a new one (no password).
      user = await repo.create({ email, fullName, role: 'devotee', googleId });
    }

    if (user.status === 'suspended' || user.status === 'banned' || user.status === 'deactivated') {
      return res.status(403).json({ error: `Account is ${user.status}` });
    }

    await issueSession(res, user, req);
  } catch (error) {
    console.error('Google Auth Error:', error);
    return res.status(401).json({ error: 'Google authentication failed' });
  }
}

module.exports = { register, registerPandit, login, logout, me, updateMe, requestOtp, verifyOtp, phoneLogin, googleAuth };
