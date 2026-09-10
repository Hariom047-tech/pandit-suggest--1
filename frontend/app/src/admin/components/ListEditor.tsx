/**
 * Ordered list-of-objects editor — the shape shared by service benefits,
 * ritual steps, samagri items and FAQs.
 *
 * One component for all four because they differ only in field labels. Four
 * near-identical editors would be four places to fix the next reordering bug.
 */
export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  width?: "full" | "half";
  /** Renders the emoji picker below instead of a plain input. */
  icon?: boolean;
}

export type ListRow = Record<string, string>;

/**
 * Quick picks for the icon field. Deliberately a short, puja-relevant set
 * rather than a full emoji keyboard: the point is to choose in one tap, and
 * anything not here can still be pasted into the box beside them.
 */
const ICON_PRESETS = [
  "🕉️", "🪔", "🙏", "📿", "🔱", "🪷", "🌸", "🌺",
  "🔥", "✨", "💫", "⭐", "☀️", "🌙", "🛕", "🧿",
];

function IconField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="list-editor__icon">
      <div className="list-editor__icon-presets">
        {ICON_PRESETS.map((ic) => (
          <button
            key={ic}
            type="button"
            // Tapping the one already chosen clears it, so an admin can get
            // back to the default without hunting for the text box.
            onClick={() => onChange(value === ic ? "" : ic)}
            className={`list-editor__icon-btn${value === ic ? " is-active" : ""}`}
            aria-label={`Use ${ic}`}
            aria-pressed={value === ic}
          >{ic}</button>
        ))}
      </div>
      <input
        className="input list-editor__icon-input"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 8))}
        placeholder="Ya koi bhi emoji paste karein"
        aria-label="Custom icon"
      />
      <p className="list-editor__hint">Khaali chhoda to default 🕉️ dikhega.</p>
    </div>
  );
}

export function ListEditor({
  label, hint, fields, rows, onChange, addLabel = "+ Add", max = 30,
}: {
  label: string;
  hint?: string;
  fields: FieldDef[];
  rows: ListRow[];
  onChange: (rows: ListRow[]) => void;
  addLabel?: string;
  max?: number;
}) {
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, ""])) as ListRow;

  const update = (i: number, key: string, value: string) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="list-editor admin-field--full">
      <div className="list-editor__head">
        <label>{label} <span className="list-editor__count">{rows.length}</span></label>
        <button
          type="button" className="btn btn-outline btn-sm"
          disabled={rows.length >= max}
          onClick={() => onChange([...rows, blank()])}
        >{addLabel}</button>
      </div>
      {hint && <p className="list-editor__hint">{hint}</p>}

      {rows.length === 0 ? (
        <p className="list-editor__empty">Abhi kuch nahi. “{addLabel}” dabakar shuru karein.</p>
      ) : (
        <ol className="list-editor__rows">
          {rows.map((row, i) => (
            <li key={i} className="list-editor__row">
              <span className="list-editor__index">{i + 1}</span>
              <div className="list-editor__fields">
                {fields.map((f) => (
                  <label
                    key={f.key}
                    className={`list-editor__field${f.width === "full" ? " is-full" : ""}`}
                  >
                    <span>{f.label}</span>
                    {f.icon ? (
                      <IconField
                        value={row[f.key] ?? ""}
                        onChange={(v) => update(i, f.key, v)}
                      />
                    ) : f.multiline ? (
                      <textarea
                        className="input" rows={2} placeholder={f.placeholder}
                        value={row[f.key] ?? ""}
                        onChange={(e) => update(i, f.key, e.target.value)}
                      />
                    ) : (
                      <input
                        className="input" placeholder={f.placeholder}
                        value={row[f.key] ?? ""}
                        onChange={(e) => update(i, f.key, e.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="list-editor__actions">
                <button type="button" className="btn btn-outline btn-sm" disabled={i === 0}
                  onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button type="button" className="btn btn-outline btn-sm" disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  aria-label="Remove">✕</button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
