import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";

// A short sample shoe used for the live illustrations below.
const SAMPLE: Outcome[] = [
  "banker", "banker", "banker", "player", "player", "banker", "player",
  "player", "player", "player", "banker", "tie", "banker", "player",
  "banker", "banker", "player", "player", "banker", "player", "banker",
  "banker", "banker", "banker", "player", "banker", "player", "player",
];

function Legend({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
      <span style={{ fontSize: 14, color: "var(--text-dim)" }}>{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 20 }}>{title}</h2>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-dim)" }}>{children}</p>;
}

export default function Guide() {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26 }}>Game Guide</h1>
      <P>
        Everything you need to know about how baccarat works and how to read
        each of the screens (roads) this app displays.
      </P>

      <Section title="1. The Basics of Baccarat">
        <P>
          Baccarat is a comparing card game between two hands: the <strong style={{ color: "var(--banker-red)" }}>Banker</strong> and
          the <strong style={{ color: "var(--player-blue)" }}>Player</strong>. You are not the "Player" — both are just
          positions you can bet on. Each hand receives two or three cards, and the hand
          closest to a total of <strong>9</strong> wins. If both hands finish equal, the result is
          a <strong style={{ color: "var(--tie-green)" }}>Tie</strong>.
        </P>
        <P>
          <strong>Card values:</strong> Aces count 1; cards 2–9 count face value; 10s and
          picture cards count 0. Only the last digit of the total matters — a hand of
          7 + 8 = 15 counts as <strong>5</strong>.
        </P>
        <P>
          <strong>Natural:</strong> if either hand's first two cards total 8 or 9, it is a
          "natural" — no more cards are drawn and the round is decided immediately.
        </P>
        <P>
          <strong>Third card:</strong> if there is no natural, fixed casino rules (no choices involved)
          decide whether the Player hand, and then the Banker hand, draws a third card. The Player
          draws on 0–5 and stands on 6–7. The Banker's draw depends on its own total and on what
          the Player drew. These rules are automatic and identical in every casino.
        </P>
        <P>
          <strong>Payouts:</strong> Player pays 1:1. Banker pays 1:1 minus 5% commission
          (because the drawing rules give Banker a slight advantage — it wins about 45.9%
          of hands vs Player's 44.6%, with ~9.5% ties). Tie usually pays 8:1.
        </P>
      </Section>

      <Section title="2. Symbols at a Glance">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 4 }}>
          <Legend label="Banker win (Bead Plate)">
            <div className="road-stone banker" style={{ width: 22, height: 22 }}>B</div>
          </Legend>
          <Legend label="Player win (Bead Plate)">
            <div className="road-stone player" style={{ width: 22, height: 22 }}>P</div>
          </Legend>
          <Legend label="Tie (Bead Plate)">
            <div className="road-stone tie" style={{ width: 22, height: 22 }}>T</div>
          </Legend>
          <Legend label="Banker win (Big Road) — hollow red ring">
            <div className="road-stone big-road-banker" style={{ width: 22, height: 22 }} />
          </Legend>
          <Legend label="Player win (Big Road) — hollow blue ring">
            <div className="road-stone big-road-player" style={{ width: 22, height: 22 }} />
          </Legend>
          <Legend label='Big Eye Road mark — hollow circle ("donut")'>
            <div className="mark-circle donut red" style={{ width: 18, height: 18 }} />
          </Legend>
          <Legend label="Small Road mark — solid circle">
            <div className="mark-circle solid blue" style={{ width: 18, height: 18 }} />
          </Legend>
          <Legend label="Cockroach Road mark — diagonal slash">
            <div className="mark-slash red" style={{ width: 18, height: 18 }} />
          </Legend>
        </div>
        <P>
          Important: on the three derived roads, <strong>red does not mean Banker and blue does
          not mean Player</strong>. Red means "the pattern is repeating / regular" and blue means
          "the pattern has broken / irregular". More on this below.
        </P>
      </Section>

      <Section title="3. Bead Plate (珠盘路)">
        <P>
          The simplest record: every hand in order, no interpretation. It fills
          <strong> top to bottom, then left to right</strong> — six per column. Banker is a red
          disc, Player blue, Tie green. It answers one question: "exactly what happened, in
          what order?"
        </P>
      </Section>

      <Section title="4. Big Road (大路)">
        <P>
          The main screen at every table. Results stack <strong>downward while the same side
          keeps winning</strong>; when the winner changes, a <strong>new column starts</strong> to
          the right. Ties don't take a cell — they are drawn as a green slash across the previous
          result. Long streaks that hit the bottom (6 deep) turn right and run along the bottom
          row — the famous "dragon tail".
        </P>
        <P>
          Reading it: tall columns mean streaks; short alternating columns mean a choppy,
          back-and-forth shoe ("ping pong").
        </P>
      </Section>

      <Section title="5. The Derived Roads — Big Eye, Small, Cockroach">
        <P>
          These three don't record wins at all. They watch the <strong>shape of the Big Road</strong> and
          ask: "is this shoe behaving in a regular, predictable way, or not?" Each new Big Road
          entry generates a mark:
        </P>
        <P>
          <strong style={{ color: "var(--banker-red)" }}>Red = regular.</strong> The Big Road is repeating
          its own pattern (e.g. columns forming at matching depths).{" "}
          <strong style={{ color: "var(--player-blue)" }}>Blue = irregular.</strong> The pattern just broke.
        </P>
        <P>
          The only difference between the three roads is <strong>how far back they compare</strong>:
          Big Eye Road compares against the previous column, Small Road skips one column back,
          and Cockroach Road skips two. Think of them as three witnesses with different memories —
          when <strong>all three agree</strong>, the shoe is behaving very consistently; when they
          disagree, the shoe is unreadable.
        </P>
        <P>
          Symbols: Big Eye uses hollow "donut" circles, Small Road uses solid circles, and
          Cockroach uses diagonal slashes ("sticks"). On casino screens the Cockroach Road often
          gets two stacked bands — when the sticks run out of room they continue on the band below,
          which is exactly how this app displays it.
        </P>
      </Section>

      <Section title="6. Worked Example — One Shoe, Every Screen">
        <P>
          Below is a 28-hand sample shoe rendered on every screen, exactly as the app draws it.
          Follow a single hand through: find it in the Bead Plate (chronological), see where it sits
          in the Big Road (streak structure), then check what marks it produced on the derived roads.
        </P>
        <RoadsDisplay outcomes={SAMPLE} compact />
      </Section>

      <Section title="7. How This App Uses the Roads">
        <P>
          Pattern players wait for moments when the shoe "reads well" — when the Big Road shows a
          clear structure and the three derived roads agree with each other. This app formalises
          that idea: your Profile records what alignment means to you, the signal panel shows a
          simple grey / amber / green playability state, and the machine entities (Sniper and
          Grinder) run their own rules alongside yours so you can compare calls before deciding
          whether to play a hand.
        </P>
        <P>
          <strong>The honest footnote:</strong> every baccarat hand is an independent event — no
          pattern changes the true odds (Banker ≈ 45.9%, Player ≈ 44.6% every single hand). The
          roads describe what <em>has happened</em>, never what <em>will happen</em>. Treat this
          app as a scoreboard, a discipline tool and a study companion — not a crystal ball.
        </P>
      </Section>
    </div>
  );
}
