// Tap-only stake fields and the casino chip row, shared by Live Session and
// Practice Play so the two slips cannot drift apart.
//
// Stakes are NEVER typed. On a phone or tablet an <input> summons the virtual
// keyboard and the browser zooms and re-flows the page around it, which drops
// the player into a shifted board mid-shoe — the worst possible moment. These
// fields are plain <button>s: tapping one makes it the field the chips add to,
// and nothing else happens. A mistake is undone with Clear and re-tapped, the
// same as pushing chips back across a real table.

import type { SideBetType } from "../../game/payouts";
import { SIDE_BET_LABELS, SIDE_BET_TYPES } from "../../game/payouts";

// One shared chip palette for every field. Table minimums (main $100, side $25)
// are applied by addStake, not by hiding chips.
export const CHIPS = [5, 25, 100, 500, 1000];

// Table minimums. The main (Banker/Player) bet is $100 minimum; side bets are
// $25 minimum. addStake snaps a field's FIRST chip up to its minimum, so a
// stake below the minimum can never be tapped in — no screen has to block.
export const MIN_MAIN_BET = 100;
export const MIN_SIDE_BET = 25;

/** The field the chips currently add to. */
export type ChipTarget = "main" | SideBetType;

/**
 * Add a chip to a field, honouring that field's minimum on the first chip:
 * the first chip lands at no less than the field's minimum ($100 main / $25
 * side), and further taps add the chip value on top.
 */
export function addStake(target: ChipTarget, current: number, value: number): number {
  const min = target === "main" ? MIN_MAIN_BET : MIN_SIDE_BET;
  return current === 0 ? Math.max(min, value) : current + value;
}

/** Human name of the field chips are landing on, for the hint line. */
export function chipTargetLabel(target: ChipTarget): string {
  return target === "main" ? "main bet" : SIDE_BET_LABELS[target];
}

function money(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

/**
 * A stake amount that is tapped, not typed. Shows `emptyLabel` at zero.
 * `active` marks it as the field the chip row is feeding.
 */
export function StakeField({
  amount, active, onSelect, emptyLabel = "$0", title,
}: {
  amount: number;
  active: boolean;
  onSelect: () => void;
  emptyLabel?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`stake-field${active ? " active" : ""}${amount > 0 ? " has-value" : ""}`}
      aria-pressed={active}
      title={title}
      onClick={onSelect}
    >
      {amount > 0 ? money(amount) : emptyLabel}
    </button>
  );
}

/** The casino chips. Each press adds its value to whichever field is active. */
export function ChipRow({ onAdd, centred }: {
  onAdd: (value: number) => void;
  centred?: boolean;
}) {
  return (
    <div className="chip-row" style={centred ? { justifyContent: "center" } : undefined}>
      {CHIPS.map(v => (
        <button
          key={v}
          type="button"
          className={`bet-chip chip-${v}`}
          onClick={() => onAdd(v)}
        >
          <span className="chip-label">${v >= 1000 ? `${v / 1000}k` : v}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Side bets with their tap-to-target stake fields. `allowed` limits the grid to
 * the side bets the chosen game offers; omit it to show every side bet.
 */
export function SideBetGrid({ values, target, onSelect, allowed }: {
  values: Partial<Record<SideBetType, number>>;
  target: ChipTarget;
  onSelect: (type: SideBetType) => void;
  allowed?: SideBetType[];
}) {
  const types = allowed ?? SIDE_BET_TYPES;
  return (
    <div className="side-bet-grid">
      {types.map(type => (
        <div className="side-bet-stake-row" key={type}>
          <span className="side-bet-stake-label">{SIDE_BET_LABELS[type]}</span>
          <StakeField
            amount={values[type] ?? 0}
            active={target === type}
            onSelect={() => onSelect(type)}
            title={`Tap, then tap chips to stake ${SIDE_BET_LABELS[type]}`}
          />
        </div>
      ))}
    </div>
  );
}

/** Tells the player where the next chip will land. */
export function ChipTargetHint({ target }: { target: ChipTarget }) {
  return (
    <div className="chip-target-hint">
      {target === "main"
        ? "Chips add to the main bet"
        : <>Chips add to <b>{SIDE_BET_LABELS[target]}</b></>}
    </div>
  );
}
