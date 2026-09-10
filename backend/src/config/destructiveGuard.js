/**
 * Refuses to let a destructive maintenance script run against production.
 *
 * Several ad-hoc scripts in backend/ (drop.js, run-wipe*.js, reset-admin.js,
 * run-migration*.js) resolve their connection from DATABASE_URL with a
 * localhost fallback. That was survivable while the only database was a local
 * Docker container. After the RDS cutover, DATABASE_URL in the deployed
 * environment IS production, so `node drop.js` would drop production's schema
 * and `node run-wipe.js` would empty its tables — with no prompt.
 *
 * These scripts are kept (they are useful against a scratch database and are
 * part of the project's history), but they now have to say who they are and
 * prove they are not pointed at anything real:
 *
 *   require('./src/config/destructiveGuard').assertDisposableTarget(url, 'drop.js');
 *
 * Two independent conditions must BOTH hold:
 *   1. the target must not look like a managed/remote endpoint, and must not
 *      be a known production database name
 *   2. the operator must set ALLOW_DESTRUCTIVE=yes for this invocation
 *
 * Condition 2 exists because condition 1 is a heuristic. Typing the variable is
 * the moment someone notices what they are about to do.
 */

const FORBIDDEN_HOST_PATTERNS = [/amazonaws\.com/i, /\.rds\./i];
const PRODUCTION_DB_NAMES = ['panditconnect', 'panditsuggest', 'panditsuggest_prod'];

function parts(connectionString) {
  const s = connectionString || '';
  const dbName = s.split('?')[0].split('/').pop() || '';
  const m = /^[a-z+]+:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(s);
  return { dbName, host: m ? m[1] : '' };
}

function refuse(lines) {
  console.error(`\n[FATAL] Destructive script refused to run.\n\n${lines.join('\n')}\n`);
  process.exit(1);
}

/**
 * @param {string} connectionString  the target this script is about to open
 * @param {string} label             the script's own name, for the message
 */
function assertDisposableTarget(connectionString, label) {
  const { dbName, host } = parts(connectionString);
  const where = `${label} -> host "${host || '(none)'}", database "${dbName || '(unset)'}"`;

  if (FORBIDDEN_HOST_PATTERNS.some((re) => re.test(host))) {
    refuse([
      'The target is a managed AWS endpoint — this is production.',
      `  ${where}`,
      '',
      'Nothing has been executed. If you genuinely need to change production,',
      'do it through a reviewed migration, not through a maintenance script.',
    ]);
  }

  if (PRODUCTION_DB_NAMES.includes(dbName)) {
    refuse([
      `The target database is named "${dbName}", which is a production name.`,
      `  ${where}`,
      '',
      'Point this at a scratch database instead.',
    ]);
  }

  if (process.env.ALLOW_DESTRUCTIVE !== 'yes') {
    refuse([
      `${label} destroys data and ALLOW_DESTRUCTIVE is not set.`,
      `  ${where}`,
      '',
      'If that target really is disposable, re-run as:',
      `  ALLOW_DESTRUCTIVE=yes node ${label}`,
    ]);
  }

  console.warn(`[${label}] destructive operation authorised against ${where}`);
}

module.exports = { assertDisposableTarget };
