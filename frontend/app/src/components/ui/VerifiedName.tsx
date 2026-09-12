import { Icon } from "../../lib/icons";

/**
 * A person's name with the verified badge welded to its LAST word.
 *
 * Two things were going wrong wherever the badge was written by hand as
 * `{name} {badge}`:
 *
 *  1. The badge is an atomic inline (an SVG box), and the line breaker is
 *     allowed to break either side of one. So a name that fitted on one line
 *     could still push its tick onto the next line all by itself — which is
 *     exactly what the English card did while the shorter Hindi name kept its
 *     tick beside the surname. Removing the space between them is not enough;
 *     the break opportunity is the box, not the space.
 *  2. Where the name block is clamped (the pandit card clamps to 2 lines), a
 *     tick pushed onto a third line is not just misplaced — it is clipped
 *     away, so a long-named pandit silently lost their verification mark.
 *
 * Splitting the last word off and holding it and the badge together in one
 * `white-space: nowrap` box fixes both: the pair is a single unbreakable unit,
 * so the tick always travels with the surname ("… Sharma✓"), whatever the
 * language, the name length or the width of the card.
 */
export function VerifiedName({
  name,
  verified = false,
  title,
  icon = "verified",
  size = 16,
  badgeClass,
}: {
  name: string;
  verified?: boolean;
  /** Tooltip on the badge — passed through translated by the caller. */
  title?: string;
  /** Which glyph: the seal ("verified") or the plain "check" some surfaces use. */
  icon?: string;
  size?: number;
  /** The surface's own badge class; it keeps owning colour and size. */
  badgeClass?: string;
}) {
  // Nothing to weld: render the name exactly as it was rendered before.
  if (!verified) return <>{name}</>;

  const words = name.trim().split(/\s+/);
  const last = words.pop() ?? "";
  const head = words.join(" ");

  return (
    <>
      {/* The space belongs here, between the head and the tail, because this
          IS a legal place to break — a 3-word name may still wrap normally. */}
      {head ? `${head} ` : null}
      <span className="name-tail">
        {last}
        <span className={badgeClass} title={title}>
          <Icon name={icon} size={size} />
        </span>
      </span>
    </>
  );
}
