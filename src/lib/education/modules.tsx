/**
 * Education module definitions.
 * Each module receives a DataBag assembled in the page and renders self-contained JSX.
 * Content is magazine-quality, factual, and uses the user's real data where available.
 */

import type { ReactNode } from "react";
import type { Overview, YearRow } from "@/lib/queries";
import { formatCents, formatQty } from "@/lib/model/money";
import { Money, PullQuote, Badge, Section, Empty } from "@/components/ui";

/* ------------------------------------------------------------------ types */

/** Tax lot row from getTaxData().lots */
export interface TaxLotRow {
  id: number;
  year: number;
  description: string;
  symbol: string | null;
  qtyMicro: number;
  acquired: string;
  sold: string;
  proceedsCents: number;
  basisCents: number | null;
  washDisallowedCents: number | null;
  gainCents: number | null;
  term: string;
}

/** Tax form row from getTaxData().forms */
export interface TaxFormRow {
  id: number;
  year: number | null;
  accountNo: string | null;
  form: string;
  payload: string; // JSON
}

/** Option position row from getOptionsReport().positions */
export interface OptionPositionRow {
  id: number;
  underlying: string;
  right: string;
  direction: string;
  strikeMicro: number;
  expiry: string;
  openedAt: string;
  closedAt: string | null;
  openPremiumCents: number;
  closePremiumCents: number;
  realizedCents: number | null;
  dteAtOpen: number | null;
  strategyLabel: string | null;
  status: string;
  outcome: string | null;
}

/** Strategy stat from getOptionsReport().byStrategy */
export interface StrategyStat {
  label: string;
  count: number;
  realizedCents: number;
  winRatePct: number | null;
}

export interface DataBag {
  overview: Overview;
  taxLots: TaxLotRow[];
  taxForms: TaxFormRow[];
  optionPositions: OptionPositionRow[];
  byStrategy: StrategyStat[];
}

export interface Module {
  slug: string;
  title: string;
  kicker: string;
  minutes: number;
  hook: string;
  render(data: DataBag): ReactNode;
}

/* ---------------------------------------------------------------- helpers */

function fmtDate(iso: string): string {
  if (!iso || iso === "VARIOUS") return iso;
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function fmtDollars(cents: number): string {
  return formatCents(cents);
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted max-w-2xl">{children}</div>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-xl text-foreground mt-8 mb-3">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h3>;
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="card border-l-2 border-l-brass px-5 py-4 text-sm text-muted max-w-2xl">
      {children}
    </div>
  );
}

function RiskBox({ children }: { children: ReactNode }) {
  return (
    <div className="card border-l-2 border-l-loss px-5 py-4 text-sm text-muted max-w-2xl">
      <span className="text-[11px] uppercase tracking-widest text-loss font-semibold block mb-1">Risk / Max Loss</span>
      {children}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto max-w-2xl">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 pr-4 text-faint uppercase tracking-wider font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/50">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-foreground num">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================= MODULES === */

/* 1. Wash Sales */
const washSales: Module = {
  slug: "wash-sales",
  title: "The 30-Day Shadow: Wash Sales",
  kicker: "Tax Mechanics",
  minutes: 6,
  hook: "Selling a loser and buying it back feels like a clean slate. The IRS disagrees — and adjusts your cost basis instead.",
  render(data) {
    const washLots = data.taxLots
      .filter((l) => (l.washDisallowedCents ?? 0) !== 0)
      .sort((a, b) => Math.abs(b.washDisallowedCents ?? 0) - Math.abs(a.washDisallowedCents ?? 0));
    const totalDisallowed = washLots.reduce((s, l) => s + Math.abs(l.washDisallowedCents ?? 0), 0);
    const hasWash = washLots.length > 0;
    const example = washLots[0] ?? null;

    return (
      <div>
        <Prose>
          <p>
            A <strong className="text-foreground">wash sale</strong> occurs when you sell a
            security at a loss and, within 30 calendar days before or after that sale, you buy{" "}
            <em>substantially identical</em> shares. The IRS disallows the loss deduction — not
            permanently, but deferred: the disallowed amount gets added to the cost basis of the
            replacement shares.
          </p>
        </Prose>

        <H2>The 61-Day Window</H2>
        <Prose>
          <p>
            People often say "30-day rule," but the actual restriction spans 61 days: 30 days
            before the sale, the sale day itself, and 30 days after. If you sell on December 15
            at a loss and buy back the same ticker on January 3, the loss is disallowed — even
            though it crosses a tax year.
          </p>
          <p>
            "Substantially identical" is not rigorously defined in statute, but the IRS treats
            the same stock, options on that stock, and convertibles as covered. Switching from{" "}
            <span className="text-foreground font-mono">SCHB</span> to{" "}
            <span className="text-foreground font-mono">VTI</span> is generally considered safe
            by most practitioners, though similar broad index ETFs can draw scrutiny. This is
            educational information — consult a tax professional for your specific situation.
          </p>
        </Prose>

        <H2>What Actually Happens to the Loss</H2>
        <InfoBox>
          <strong className="text-foreground">The loss is not gone — it is postponed.</strong>{" "}
          The disallowed loss is added to the cost basis of the replacement lot. When you
          eventually sell the replacement shares without triggering another wash sale, you recover
          the full economic loss at that time. The harm is timing: you lose the deduction for the
          current tax year.
        </InfoBox>

        <H2>IRA Complications</H2>
        <Prose>
          <p>
            If you sell at a loss in a taxable account and buy the same security in an IRA within
            the 61-day window, the wash sale still triggers — but the basis adjustment cannot be
            added to the IRA (which has no cost basis in the traditional sense). The loss
            disappears permanently. This is one of the most common and costly mistakes in
            multi-account management.
          </p>
        </Prose>

        {hasWash ? (
          <>
            <H2>Your Wash Sales</H2>
            <Prose>
              <p>
                Your tax data contains <strong className="text-foreground">{washLots.length}</strong>{" "}
                lot{washLots.length !== 1 ? "s" : ""} with disallowed wash-sale losses totaling{" "}
                <span className="text-loss num">{fmtDollars(totalDisallowed)}</span>. These losses
                shifted your basis forward into the replacement lots rather than reducing your
                taxable income in the year of sale.
              </p>
            </Prose>
            {example && (
              <>
                <H3>Case Study: {example.symbol ?? example.description}</H3>
                <DataTable
                  headers={["Field", "Value"]}
                  rows={[
                    ["Security", example.symbol ?? example.description],
                    ["Sold", fmtDate(example.sold)],
                    ["Acquired", fmtDate(example.acquired)],
                    ["Proceeds", fmtDollars(example.proceedsCents)],
                    ["Basis", example.basisCents != null ? fmtDollars(example.basisCents) : "—"],
                    ["Realized loss before adjustment", example.gainCents != null ? fmtDollars(example.gainCents) : "—"],
                    ["Disallowed (wash)", <span key="w" className="text-loss">{fmtDollars(Math.abs(example.washDisallowedCents ?? 0))}</span>],
                  ]}
                />
                <Prose>
                  <p>
                    The {fmtDollars(Math.abs(example.washDisallowedCents ?? 0))} disallowed loss
                    on this lot was added to the basis of the replacement shares purchased within
                    the 61-day window. You will recover it when those replacement shares are
                    eventually sold outside a wash-sale window.
                  </p>
                </Prose>
              </>
            )}
          </>
        ) : (
          <>
            <H2>Your Wash Sales</H2>
            <Empty>No wash-sale adjustments found in your tax data. Either you haven't triggered any, or your 1099-B has not been imported yet.</Empty>
          </>
        )}

        <H2>Avoiding Wash Sales</H2>
        <Prose>
          <p>
            Common strategies include: waiting the full 61-day window before repurchasing, tax-loss
            harvesting into a substantially different (not substantially identical) security to
            maintain market exposure, or accepting the wash-sale treatment on small lots where the
            tax impact is negligible. Automated tracking — which this app provides through your
            imported 1099-B data — is the most reliable safeguard.
          </p>
        </Prose>

        <RiskBox>
          Wash-sale disallowance is a deferral, not a permanent loss — except when the replacement
          purchase is inside an IRA, where the loss disappears entirely. The maximum "cost" of a
          wash sale is the tax deduction on the disallowed loss for the current year.
        </RiskBox>
      </div>
    );
  },
};

/* 2. Lot Accounting */
const lotAccounting: Module = {
  slug: "lot-accounting",
  title: "Which Shares Did You Sell? Lot Accounting",
  kicker: "Cost Basis",
  minutes: 7,
  hook: "When you hold a position built across multiple purchases, which shares you sell first changes your gain, your term, and your tax.",
  render(data) {
    // Find a symbol with multiple acquired dates and same sold date
    const bySymbolSold = new Map<string, TaxLotRow[]>();
    for (const lot of data.taxLots) {
      if (!lot.symbol) continue;
      const key = `${lot.symbol}|${lot.sold}`;
      const group = bySymbolSold.get(key) ?? [];
      group.push(lot);
      bySymbolSold.set(key, group);
    }
    const multiLotGroups = [...bySymbolSold.values()].filter(
      (g) => g.length > 1 && g.some((l) => l.acquired !== "VARIOUS"),
    );
    multiLotGroups.sort((a, b) => b.length - a.length);
    const example = multiLotGroups[0] ?? null;

    return (
      <div>
        <Prose>
          <p>
            Every share purchase creates a distinct tax lot with its own acquisition date and cost
            basis. When you sell shares, the IRS needs to know exactly which lot you sold — because
            different lots of the same stock can have different per-share basis and different holding
            periods, leading to materially different tax outcomes.
          </p>
        </Prose>

        <H2>FIFO: The Default Method</H2>
        <Prose>
          <p>
            If you don't specify which shares to sell, most brokers apply{" "}
            <strong className="text-foreground">First In, First Out (FIFO)</strong>: the oldest
            shares are sold first. FIFO is simple and the IRS-accepted default, but it can be
            suboptimal: your oldest shares may have the lowest basis (largest gain) or may be
            short-term when you'd prefer to harvest long-term treatment.
          </p>
        </Prose>

        <H2>Specific Identification</H2>
        <Prose>
          <p>
            <strong className="text-foreground">Specific identification</strong> lets you choose
            exactly which lot to sell at the time of the transaction. You might choose to sell:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>A lot with a high basis to minimize the realized gain;</li>
            <li>A short-term lot about to cross the one-year mark, to wait for long-term rates;</li>
            <li>A losing lot to harvest the loss for tax offset purposes.</li>
          </ul>
          <p>
            To use specific identification you must communicate your lot choice to your broker at or
            before the time of sale and retain written confirmation. Most modern brokerage interfaces
            allow this directly in the order flow.
          </p>
        </Prose>

        <H2>Fractional Shares: Why the Math Gets Precise</H2>
        <InfoBox>
          Fractional-share investing means a single "buy" at market open might be allocated across
          multiple lot entries at slightly different per-share prices. When you sell fractional
          shares, the per-share basis must be calculated to many decimal places to avoid rounding
          errors that accumulate across dozens of small lots. This system stores quantities in
          micro-shares (millionths) and basis in cents to maintain exact integer arithmetic.
        </InfoBox>

        <H2>Short-Term vs. Long-Term</H2>
        <Prose>
          <p>
            The holding period — from acquisition date to sale date — determines whether a gain or
            loss is short-term (held ≤1 year, taxed as ordinary income) or long-term (held &gt;1
            year, taxed at preferential rates of 0%, 15%, or 20% depending on income). Even a
            single day can move a position from one category to the other.
          </p>
        </Prose>

        {example ? (
          <>
            <H2>Your Multi-Lot Example: {example[0].symbol}</H2>
            <Prose>
              <p>
                On <strong className="text-foreground">{fmtDate(example[0].sold)}</strong> you sold{" "}
                {example.length} lots of{" "}
                <span className="text-foreground font-mono">{example[0].symbol}</span> that had
                been acquired at different times. Here is how each lot's accounting played out:
              </p>
            </Prose>
            <DataTable
              headers={["Acquired", "Term", "Qty", "Basis", "Proceeds", "Gain / Loss"]}
              rows={example.map((lot) => [
                fmtDate(lot.acquired),
                <Badge key="t" tone={lot.term === "long" ? "gain" : "loss"}>{lot.term}</Badge>,
                formatQty(lot.qtyMicro),
                lot.basisCents != null ? fmtDollars(lot.basisCents) : "—",
                fmtDollars(lot.proceedsCents),
                <span key="g" className={lot.gainCents != null && lot.gainCents >= 0 ? "text-gain" : "text-loss"}>
                  {lot.gainCents != null ? fmtDollars(lot.gainCents) : "—"}
                </span>,
              ])}
            />
            <Prose>
              <p>
                Notice how the same security sold on the same day produces different tax outcomes
                depending on which lot the broker attributed to the sale. Under FIFO, the broker
                sold the earliest-acquired shares first. Specific identification would have allowed
                you to choose the lot with the highest basis or the most favorable holding period.
              </p>
            </Prose>
          </>
        ) : (
          <>
            <H2>Worked Example</H2>
            <Empty>No multi-lot sales found in your tax data yet. Import your 1099-B to see a real worked example from your own trades.</Empty>
            <Prose>
              <p>
                A typical multi-lot scenario: you bought 10 shares at $100 in January, then 10
                more at $120 in August. You sell 10 shares in February of the following year at
                $115. Under FIFO, you sell the January lot: $150 long-term gain. Under specific
                identification, you sell the August lot: $50 short-term loss — a dramatically
                different tax picture from an identical economic transaction.
              </p>
            </Prose>
          </>
        )}

        <H2>Practical Rules</H2>
        <Prose>
          <p>
            Most tax professionals recommend reviewing your open lots before any significant sale,
            particularly near year-end. The analysis is straightforward: enumerate every open lot,
            note its basis, term, and current unrealized P&L, then model the tax impact of
            different lot-selection choices before confirming the trade.
          </p>
        </Prose>

        <RiskBox>
          The maximum cost of poor lot selection is the difference in tax between the worst
          available lot and the best available lot — often thousands of dollars on a single large
          position. This is an entirely avoidable cost; it requires only awareness, not market
          prediction.
        </RiskBox>
      </div>
    );
  },
};

/* 3. Options Greeks */
const optionsGreeks: Module = {
  slug: "options-greeks",
  title: "The Greeks: What Moves Your Option",
  kicker: "Options Education",
  minutes: 8,
  hook: "Delta, theta, vega, and gamma aren't just academic — they describe exactly why your option went up, down, or sideways.",
  render(data) {
    const positions = data.optionPositions;
    const shortPut = positions.find((p) => p.direction === "short" && p.right === "P" && p.realizedCents != null);
    const longCall = positions.find((p) => p.direction === "long" && p.right === "C" && p.realizedCents != null);

    const strikeFmt = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`;

    return (
      <div>
        <Prose>
          <p>
            Options prices don't move randomly — they respond to precisely quantifiable forces.
            The <strong className="text-foreground">Greeks</strong> are sensitivity measures:
            each one describes how much an option's value changes when a single input moves by a
            small amount. Understanding them turns a confusing price chart into a readable
            narrative.
          </p>
        </Prose>

        <H2>Delta (Δ): Directional Exposure</H2>
        <Prose>
          <p>
            Delta measures how much the option price changes for a $1 move in the underlying.
            A call with delta 0.50 gains approximately $0.50 per share (×100 for one contract)
            for every $1 rise in the stock. Puts have negative delta: a put with delta −0.40
            gains roughly $0.40 per share when the stock falls $1.
          </p>
          <p>
            Delta also approximates the market's implied probability that the option expires
            in-the-money. A 0.30-delta call is "about 30% likely" to finish above the strike
            at expiration. Deep in-the-money options approach delta 1.0 and behave like stock;
            far out-of-the-money options have delta near zero.
          </p>
        </Prose>
        <InfoBox>
          <strong className="text-foreground">Position delta</strong> = option delta × contracts ×
          100. A 5-contract short put with delta −0.25 carries position delta of +125: you're
          long 125 "equivalent shares" of directional risk.
        </InfoBox>

        <H2>Theta (Θ): Time Decay</H2>
        <Prose>
          <p>
            Theta is the amount an option loses per calendar day from time decay alone, all else
            equal. A theta of −$5.00 means the option loses roughly $5 per day as expiration
            approaches. Time decay is not linear: it accelerates exponentially in the final 30
            days, which is why sellers of options — who have positive theta — focus on near-term
            expiration, and why long options are "fighting the clock."
          </p>
        </Prose>

        <H2>Vega (V): Volatility Sensitivity</H2>
        <Prose>
          <p>
            Vega measures how much the option's value changes for each 1-point move in implied
            volatility (IV). A vega of $0.15 means the option gains $0.15 per share for every
            point IV rises. Sellers of options are short vega: a volatility spike after you sell
            a covered call or cash-secured put hurts you even if the underlying hasn't moved.
          </p>
        </Prose>

        <H2>Gamma (Γ): The Acceleration of Delta</H2>
        <Prose>
          <p>
            Gamma measures how quickly delta changes as the underlying moves. Near-the-money
            options with short time to expiration have very high gamma: a $1 move might shift
            delta by 0.10 or more, which means your exposure is changing rapidly. Short-gamma
            positions (selling near-expiry options) can produce large losses on sharp moves
            because the position "rolls over" into deep in-the-money territory faster than
            risk models anticipate.
          </p>
        </Prose>

        {shortPut ? (
          <>
            <H2>Your Short Put: {shortPut.underlying} {strikeFmt(shortPut.strikeMicro)}P {shortPut.expiry}</H2>
            <Prose>
              <p>
                When you sold this put, theta was working{" "}
                <strong className="text-foreground">for you</strong>: every day that passed
                without a significant drop in {shortPut.underlying} eroded the option's extrinsic
                value, which you would pocket at expiration or close. You collected{" "}
                <span className="text-gain num">{fmtDollars(Math.abs(shortPut.openPremiumCents))}</span>{" "}
                in premium at open.
              </p>
              <p>
                Your vega exposure was negative: if implied volatility spiked after you sold
                (a common occurrence during earnings or macro events), the mark-to-market loss
                would have appeared even with no underlying move — this is the characteristic
                "IV crush worked against me" scenario.
              </p>
              {shortPut.realizedCents != null && (
                <p>
                  This position closed with a realized P&L of{" "}
                  <span className={shortPut.realizedCents >= 0 ? "text-gain num" : "text-loss num"}>
                    {fmtDollars(shortPut.realizedCents)}
                  </span>
                  {shortPut.dteAtOpen != null && ` after opening with ${shortPut.dteAtOpen} days to expiry`}.
                </p>
              )}
            </Prose>
          </>
        ) : null}

        {longCall ? (
          <>
            <H2>Your Long Call: {longCall.underlying} {strikeFmt(longCall.strikeMicro)}C {longCall.expiry}</H2>
            <Prose>
              <p>
                As a long call buyer, theta was working{" "}
                <strong className="text-foreground">against you</strong>: each day of passage
                cost you time value. You paid{" "}
                <span className="text-loss num">{fmtDollars(Math.abs(longCall.openPremiumCents))}</span>{" "}
                in premium. To profit, the underlying needed to move enough, fast enough, to
                overcome both theta decay and the initial premium cost.
              </p>
              <p>
                Your vega exposure was positive: an IV expansion would have helped you even
                before the underlying moved. This is why options buyers sometimes profit from
                uncertainty events (earnings, economic reports) regardless of the direction of
                the move.
              </p>
              {longCall.realizedCents != null && (
                <p>
                  This position closed with a realized P&L of{" "}
                  <span className={longCall.realizedCents >= 0 ? "text-gain num" : "text-loss num"}>
                    {fmtDollars(longCall.realizedCents)}
                  </span>.
                </p>
              )}
            </Prose>
          </>
        ) : null}

        {!shortPut && !longCall && (
          <>
            <H2>Your Options Data</H2>
            <Empty>No closed option positions found yet. Once you have closed short-put or long-call positions, this module will show you a live greek narrative from your own trades.</Empty>
          </>
        )}

        <H2>How Greeks Interact</H2>
        <Prose>
          <p>
            Greeks don't act in isolation. A short put earns theta daily but loses when the
            underlying drops (negative delta) or when IV rises (negative vega). A long call needs
            the underlying to rise faster than theta decays the position, and benefits from IV
            expansion. Gamma risk is highest for short near-expiry positions: the closer to
            expiration and the closer to the strike, the faster delta (and therefore P&L) can
            shift.
          </p>
          <p>
            Professional traders typically hedge their delta exposure with the underlying while
            running net-positive or net-negative theta/vega books — a level of complexity beyond
            most retail accounts. For a single-position retail trader, the practical takeaway is
            to understand your theta sign (are you the clock-buyer or the clock-seller?) and
            your vega sign (do you want more or less volatility?) before entering any options trade.
          </p>
        </Prose>

        <RiskBox>
          Options can expire worthless (buyer loses 100% of premium) or, for short uncovered
          options, losses can theoretically be unlimited (short call) or very large (short put:
          maximum loss ≈ strike price × 100 per contract, less premium received). Understand
          your max-loss scenario before opening a position.
        </RiskBox>
      </div>
    );
  },
};

/* 4. Position Sizing */
const positionSizing: Module = {
  slug: "position-sizing",
  title: "Position Sizing: How Much Is Right?",
  kicker: "Risk Management",
  minutes: 7,
  hook: "Being right about a stock doesn't matter if the position was too large to survive the drawdown.",
  render(data) {
    // Estimate median buy size from holdings costCents
    const holdings = data.overview.holdings.filter((h) => !h.isMoneyMarket && h.costCents != null && h.costCents > 0);
    const costs = holdings.map((h) => h.costCents ?? 0).sort((a, b) => a - b);
    const median = costs.length > 0 ? costs[Math.floor(costs.length / 2)] : null;
    const totalPortfolio = holdings.reduce((s, h) => s + (h.costCents ?? 0), 0);

    // Options sizing
    const optVitals = data.overview.optionsVitals;

    return (
      <div>
        <Prose>
          <p>
            Position sizing is the single decision with the largest impact on long-term survival as
            a trader — more than entry timing, more than stock selection, more than any indicator.
            A correctly-sized bad trade is recoverable. An oversized good idea can still blow up
            a portfolio through normal volatility.
          </p>
        </Prose>

        <H2>Risk Per Trade: The First Constraint</H2>
        <Prose>
          <p>
            Start with a single question: <em>How much of my portfolio am I willing to lose if this
            trade goes to zero?</em> Most risk-management frameworks suggest no more than 1–2% of
            total portfolio value on a single position's defined max loss. For a $50,000 portfolio,
            that's a $500–$1,000 maximum loss per trade — not maximum position size, but maximum
            tolerable loss.
          </p>
          <p>
            If you buy a stock at $50 with a stop-loss at $45, your risk per share is $5. A $1,000
            risk allowance supports 200 shares × $5 = $10,000 position. The math runs from your
            defined risk, not from an arbitrary "let me put in $10,000."
          </p>
        </Prose>

        <H2>Kelly Criterion: A Mathematically Optimal Framework</H2>
        <Prose>
          <p>
            The Kelly Criterion says the theoretically optimal fraction of capital to risk per trade
            is: <code className="text-brass-bright text-xs">f* = (edge) / (odds)</code> where edge
            is your win probability minus your loss probability, and odds is the payoff ratio.
          </p>
          <p>
            Full Kelly is almost always too aggressive for real trading — variance is too high and
            the formula assumes precise knowledge of your edge, which you don't have. Professional
            traders typically use <strong className="text-foreground">quarter-Kelly or
            half-Kelly</strong> as a practical upper bound: it sacrifices less than 25% of the
            theoretical long-run growth rate while dramatically reducing drawdown and ruin risk.
          </p>
        </Prose>
        <InfoBox>
          Example: If your system wins 55% of the time with a 1:1 payoff, full Kelly says risk
          10% per trade. Half-Kelly is 5%, quarter-Kelly is 2.5%. In practice, 1–2% is
          defensible; anything above 5% on a single trade requires extraordinary confidence in
          your edge estimate.
        </InfoBox>

        <H2>Portfolio Heat: The Second Constraint</H2>
        <Prose>
          <p>
            Even if every individual trade is sized correctly, too many positions at once can
            create correlated risk. If you hold 10 momentum stocks all in the same sector and
            that sector corrects, you face 10 simultaneous losses.{" "}
            <strong className="text-foreground">Portfolio heat</strong> is the sum of all
            open position risk (max loss on each) as a percentage of total capital. Most
            frameworks cap total portfolio heat at 10–20%.
          </p>
        </Prose>

        {(median != null && totalPortfolio > 0) ? (
          <>
            <H2>Your Portfolio Context</H2>
            <Prose>
              <p>
                Your current open holdings show a median position cost of{" "}
                <span className="text-foreground num">{fmtDollars(median)}</span> across{" "}
                {holdings.length} position{holdings.length !== 1 ? "s" : ""}, with a total cost
                basis of{" "}
                <span className="text-foreground num">{fmtDollars(totalPortfolio)}</span>.
                A 1% portfolio-risk rule on this portfolio suggests a maximum tolerable loss of{" "}
                <span className="text-loss num">{fmtDollars(Math.round(totalPortfolio * 0.01))}</span>{" "}
                per new trade, and a 2% rule allows{" "}
                <span className="text-loss num">{fmtDollars(Math.round(totalPortfolio * 0.02))}</span>.
              </p>
              {optVitals && (
                <p>
                  On the options side, you have {optVitals.totalPositions} total option positions.
                  Each options premium sold of ~
                  {optVitals.premiumSoldCents > 0 && optVitals.totalPositions > 0
                    ? fmtDollars(Math.round(optVitals.premiumSoldCents / optVitals.totalPositions))
                    : "—"}{" "}
                  on average carries assignment risk of the full strike price per contract — factor
                  that into your portfolio heat, not just the premium received.
                </p>
              )}
            </Prose>
          </>
        ) : (
          <>
            <H2>Your Portfolio</H2>
            <Empty>No open holding data yet. Import your brokerage data to see personalized position-sizing context.</Empty>
          </>
        )}

        <H2>Common Sizing Mistakes</H2>
        <Prose>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-foreground">Conviction sizing</strong>: doubling down on a
              position because you "really believe in it." Conviction doesn't reduce variance.
            </li>
            <li>
              <strong className="text-foreground">Forgetting correlation</strong>: 10 "diversified"
              tech stocks are not 10 independent bets.
            </li>
            <li>
              <strong className="text-foreground">Ignoring options notional</strong>: a $500
              premium on a $5,000 cash-secured put carries $5,000 of real capital obligation,
              not $500.
            </li>
            <li>
              <strong className="text-foreground">Static sizing</strong>: as your account grows or
              shrinks, dollar-risk per trade should be recalculated, not fixed at an old number.
            </li>
          </ul>
        </Prose>

        <RiskBox>
          No position-sizing rule eliminates the risk of loss — it manages the size of loss
          relative to your capital base. Gap moves, halts, and black-swan events can exceed
          any stop-loss. Options assignment and exercise can create overnight positions larger
          than intended. Size accordingly.
        </RiskBox>
      </div>
    );
  },
};

/* 5. IRA Early Distributions */
const iraEarlyDistributions: Module = {
  slug: "ira-early-distributions",
  title: "Early IRA Distributions: The Real Cost",
  kicker: "Retirement Accounts",
  minutes: 6,
  hook: "Taking money out of an IRA before 59½ triggers two separate tax events — and the math is almost always unfavorable.",
  render(data) {
    // Find 1099-R forms with code 1 (early distribution)
    const forms1099R = data.taxForms.filter((f) => f.form === "1099-R");
    const earlyDistForms = forms1099R.filter((f) => {
      try {
        const p = JSON.parse(f.payload);
        return p.distributionCode === "1" || p.code === "1" || p.distributionCodes?.includes("1");
      } catch { return false; }
    });

    // Find 5498 forms
    const forms5498 = data.taxForms.filter((f) => f.form === "5498");

    return (
      <div>
        <Prose>
          <p>
            Individual Retirement Accounts receive favorable tax treatment in exchange for a
            long-term commitment: keep the money invested until at least age 59½. Pull it out
            early, and you face a two-layer penalty: the money is taxed as ordinary income{" "}
            <em>and</em> subject to an additional 10% early-distribution penalty on top.
          </p>
        </Prose>

        <H2>The Mechanics: Traditional IRA</H2>
        <Prose>
          <p>
            Contributions to a traditional IRA are typically pre-tax (deductible). Growth is
            tax-deferred. When you withdraw, 100% of the distribution is added to your ordinary
            income for that year. If you withdraw before 59½ without a qualifying exception, you
            also owe an{" "}
            <strong className="text-foreground">additional 10% early-distribution tax</strong>{" "}
            on the amount withdrawn — reported separately on Form 5329.
          </p>
          <p>
            For someone in the 22% federal bracket, an early $10,000 distribution results in
            $2,200 in regular income tax plus $1,000 in the 10% penalty — effectively a 32%
            tax rate before state taxes. The net received: $6,800 or less.
          </p>
        </Prose>

        <H2>Roth IRA: Different Rules</H2>
        <Prose>
          <p>
            Roth contributions (after-tax) can always be withdrawn tax- and penalty-free because
            you already paid tax on them. However,{" "}
            <strong className="text-foreground">earnings</strong> in a Roth are subject to the
            same early-withdrawal rules as a traditional IRA: taxable as ordinary income plus 10%
            additional tax if withdrawn before 59½ and the account hasn't been open at least 5
            years.
          </p>
        </Prose>

        <H2>Qualified Exceptions to the 10% Penalty</H2>
        <InfoBox>
          The IRS permits penalty-free early withdrawals (though income tax still applies) for:
          first-time home purchase (up to $10,000 lifetime), qualified higher-education expenses,
          substantially equal periodic payments (SEPP / 72(t)), disability, medical expenses
          exceeding 7.5% of AGI, health insurance premiums while unemployed, and several others.
          Each exception has specific qualifying requirements.
        </InfoBox>

        {forms1099R.length > 0 ? (
          <>
            <H2>Your 1099-R Forms</H2>
            <Prose>
              <p>
                Your tax data includes{" "}
                <strong className="text-foreground">{forms1099R.length}</strong> Form 1099-R
                record{forms1099R.length !== 1 ? "s" : ""} (distributions from retirement accounts).
                {earlyDistForms.length > 0
                  ? ` Of these, ${earlyDistForms.length} show distribution code "1" (early distribution, no known exception).`
                  : " None show distribution code \"1\" (early distribution) — any withdrawals appear to have qualified for an exception or occurred after age 59½."}
              </p>
            </Prose>
            {earlyDistForms.length > 0 && (
              <DataTable
                headers={["Year", "Account", "Form"]}
                rows={earlyDistForms.map((f) => [
                  String(f.year ?? "—"),
                  f.accountNo ?? "—",
                  f.form,
                ])}
              />
            )}
          </>
        ) : (
          <>
            <H2>Your 1099-R Forms</H2>
            <Empty>No 1099-R forms imported yet. If you have had retirement account distributions, import your tax documents to see them here.</Empty>
          </>
        )}

        <H2>Rollover Mechanics (5498)</H2>
        <Prose>
          <p>
            Form 5498 reports IRA contributions and rollovers. A direct rollover — from a 401(k)
            to an IRA, for example — is not a distribution and triggers no tax or penalty. An
            indirect rollover places the funds in your hands: the payer withholds 20%, and you
            have 60 days to deposit the full original amount (including the withheld portion from
            other funds) into the new IRA to avoid a taxable event. Missing the 60-day window or
            depositing less than the full amount treats the shortfall as a distribution.
          </p>
          {forms5498.length > 0 ? (
            <p>
              Your data includes <strong className="text-foreground">{forms5498.length}</strong>{" "}
              Form 5498 record{forms5498.length !== 1 ? "s" : ""}, covering rollover and
              contribution activity.
            </p>
          ) : null}
        </Prose>

        <H2>The Opportunity Cost Beyond the Tax</H2>
        <Prose>
          <p>
            The tax and penalty are only part of the cost. Money removed from a tax-advantaged
            account permanently loses the shelter of tax-free growth on that amount. A $10,000
            withdrawal that would have compounded at 7% annually for 20 years forgoes
            approximately $38,700 in additional future value — before considering the lost
            tax shelter on the growth.
          </p>
        </Prose>

        <RiskBox>
          Early distributions trigger ordinary income tax on the full amount plus a 10% additional
          tax. State income taxes may apply on top. The net cost of an early withdrawal is
          consistently higher than most people estimate before doing the math.
        </RiskBox>
      </div>
    );
  },
};

/* 6. Cash Buffer */
const cashBuffer: Module = {
  slug: "cash-buffer",
  title: "The Cash Buffer: Stop Timing the Market for the Wrong Reasons",
  kicker: "Financial Foundation",
  minutes: 6,
  hook: "The most dangerous reason to sell is not conviction — it's necessity. A cash buffer separates your investment account from your life.",
  render(data) {
    const years = data.overview.years.filter((y) => y.withdrawalsCents > 0 || y.depositsCents > 0);
    const totalDeposits = years.reduce((s, y) => s + y.depositsCents, 0);
    const totalWithdrawals = years.reduce((s, y) => s + y.withdrawalsCents, 0);

    // Find years where withdrawals exceeded deposits (stress years)
    const stressYears = years.filter((y) => y.withdrawalsCents > y.depositsCents);

    // Find cluster sell days from overview data (approximate: use years with net withdrawal)
    const worstWithdrawalYear = [...years].sort((a, b) => b.withdrawalsCents - a.withdrawalsCents)[0];

    // Estimate monthly spend proxy (average withdrawal per month in withdrawal years)
    const withdrawalYears = years.filter((y) => y.withdrawalsCents > 0);
    const avgMonthlyWithdrawal = withdrawalYears.length > 0
      ? Math.round(withdrawalYears.reduce((s, y) => s + y.withdrawalsCents, 0) / (withdrawalYears.length * 12))
      : null;
    const threeMonthBuffer = avgMonthlyWithdrawal ? avgMonthlyWithdrawal * 3 : null;

    return (
      <div>
        <Prose>
          <p>
            Market timing is hard. But there is a particularly insidious form of it that isn't
            driven by market analysis at all: forced selling — selling investments because you
            need the cash for rent, an unexpected bill, or an income gap. When life creates
            urgency, you sell whatever is liquid, at whatever the current price is, without any
            regard for whether the position makes sense to close.
          </p>
          <p>
            A separate, liquid cash buffer — held outside your investment account — eliminates
            this problem entirely. It decouples your investment decisions from your cash-flow needs.
          </p>
        </Prose>

        <H2>Why Investment Accounts Make Poor Emergency Funds</H2>
        <Prose>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Market drawdowns and cash needs are <strong className="text-foreground">positively
              correlated with life stress</strong>: you most need the money when market prices
              are lowest (recessions, layoffs, economic disruption).
            </li>
            <li>
              Selling stock triggers taxable events — gains you didn't plan for, losses that may
              be disallowed if you repurchase, wash-sale complications.
            </li>
            <li>
              Options positions may not be liquid on short notice, and assignment or exercise
              can create complex positions at the worst moment.
            </li>
          </ul>
        </Prose>

        <H2>The 3-to-6 Month Rule</H2>
        <InfoBox>
          Most financial planners suggest maintaining 3–6 months of essential living expenses in a
          liquid, FDIC-insured account (high-yield savings, money market fund outside your
          brokerage). Essential expenses are fixed costs: housing, food, utilities, insurance,
          minimum debt payments — not discretionary spending.
        </InfoBox>

        {years.length > 0 ? (
          <>
            <H2>Your Deposit and Withdrawal History</H2>
            <DataTable
              headers={["Year", "Deposits", "Withdrawals", "Net Flow"]}
              rows={years.map((y) => {
                const net = y.depositsCents - y.withdrawalsCents;
                return [
                  String(y.year),
                  <span key="d" className="text-gain">{fmtDollars(y.depositsCents)}</span>,
                  <span key="w" className={y.withdrawalsCents > 0 ? "text-loss" : "text-muted"}>{fmtDollars(y.withdrawalsCents)}</span>,
                  <span key="n" className={net >= 0 ? "text-gain" : "text-loss"}>{fmtDollars(net)}</span>,
                ];
              })}
            />

            {stressYears.length > 0 && (
              <Prose>
                <p>
                  In <strong className="text-foreground">{stressYears.length}</strong> year
                  {stressYears.length !== 1 ? "s" : ""} ({stressYears.map((y) => y.year).join(", ")}),
                  withdrawals exceeded deposits. These are the years where life urgency potentially
                  drove investment decisions. A prefunded cash buffer in those years would have
                  protected your investment account from the pressure.
                </p>
              </Prose>
            )}

            {threeMonthBuffer && (
              <Prose>
                <p>
                  Based on your withdrawal history, a 3-month emergency buffer would be
                  approximately{" "}
                  <span className="text-foreground num">{fmtDollars(threeMonthBuffer)}</span>.
                  This is the amount that, if held separately from your investment account in a
                  liquid savings vehicle, would have insulated your investment decisions from
                  cash-flow pressure for a full quarter.
                </p>
              </Prose>
            )}
          </>
        ) : (
          <>
            <H2>Your Cash Flow History</H2>
            <Empty>No deposit or withdrawal history found yet. Import your transaction data to see your year-by-year flow analysis.</Empty>
          </>
        )}

        <H2>Where to Hold It</H2>
        <Prose>
          <p>
            The cash buffer should be held in a high-yield savings account or money-market fund
            at a separate institution from your brokerage — the slight friction of a transfer
            is a feature, not a bug: it discourages impulsive "borrowing" from yourself.
            Treasury bills and short-term CD ladders are also appropriate for the portion beyond
            the first month's expenses.
          </p>
          <p>
            The buffer is not a trading account, not an opportunity fund, not a place to hold
            "dry powder" for market dips. It is insurance against life events, and its function
            is to ensure your investment account is used only for investing decisions, never
            for survival decisions.
          </p>
        </Prose>

        <H2>The Behavioral Return</H2>
        <Prose>
          <p>
            The financial return of a cash buffer isn't measured in interest earned on the savings
            account — it's measured in the forced sales you didn't make during drawdowns, the
            panic trades you didn't execute under financial duress, and the compounding you
            didn't interrupt. For most retail traders, the behavioral alpha from a buffer exceeds
            the opportunity cost of keeping 3 months of expenses in a 4–5% savings account by
            a significant margin.
          </p>
        </Prose>

        <RiskBox>
          The maximum cost of maintaining a cash buffer is the opportunity cost of returns not
          earned on the buffer amount — typically 2–5% annually on 3–6 months of expenses.
          The maximum cost of not having one is a forced sale at a market bottom, a missed
          recovery, and the permanent destruction of that capital's compounding trajectory.
        </RiskBox>
      </div>
    );
  },
};

/* 7. Strategy Library */
const strategyLibrary: Module = {
  slug: "strategy-library",
  title: "The Options Playbook",
  kicker: "Strategy Reference",
  minutes: 12,
  hook: "Eight strategies, from basic to complex. Plain language, payoff shapes, max loss, and whether you've run each one.",
  render(data) {
    const byStrategy = data.byStrategy;
    const findStat = (labels: string[]) =>
      byStrategy.find((s) => labels.some((l) => s.label.toUpperCase().includes(l.toUpperCase())));

    interface StrategyDef {
      name: string;
      aliases: string[];
      when: string;
      payoff: string;
      maxLoss: string;
      maxGain: string;
      dte: string;
      mistakes: string;
    }

    const strategies: StrategyDef[] = [
      {
        name: "Long Call",
        aliases: ["LONG CALL"],
        when: "You expect a significant upward move in the underlying before expiration.",
        payoff: "Profits increase as the stock rises above the strike + premium paid. Below the breakeven (strike + premium), the option expires worthless.",
        maxLoss: "100% of premium paid. Defined and limited to the entry cost.",
        maxGain: "Theoretically unlimited as the stock rises.",
        dte: "30–60 DTE is common; shorter DTE amplifies theta risk.",
        mistakes: "Buying too close to expiration (theta crush), buying out-of-the-money calls on high-IV underlyings (overpaying for extrinsic value), not accounting for vega collapse after events.",
      },
      {
        name: "Long Put",
        aliases: ["LONG PUT"],
        when: "You expect a significant downward move, or want portfolio insurance against a decline.",
        payoff: "Profits increase as the stock falls below the strike − premium paid. Above breakeven, the option expires worthless.",
        maxLoss: "100% of premium paid.",
        maxGain: "Substantial (stock can fall to zero, capped at strike − premium received).",
        dte: "30–90 DTE for directional bets; longer for portfolio hedges.",
        mistakes: "Hedging with too-short-dated puts that expire before the expected event, underestimating IV expansion cost on high-IV names.",
      },
      {
        name: "Covered Call",
        aliases: ["COVERED CALL", "CC"],
        when: "You hold stock and are willing to sell it at the strike price; you want to earn premium income against the position.",
        payoff: "Capped upside: if the stock rises above the strike, the shares are called away at the strike. You keep the premium regardless.",
        maxLoss: "Stock price minus premium received (same as owning the stock, reduced by premium).",
        maxGain: "(Strike − cost basis) + premium received. Upside is capped at the strike.",
        dte: "21–45 DTE is the common range for weekly or monthly cycles.",
        mistakes: "Selling a strike too close and capping a big move, selling during earnings without realizing IV is elevated for a reason, forgetting assignment can happen early on American-style options.",
      },
      {
        name: "Cash-Secured Put (CSP)",
        aliases: ["SHORT PUT", "CSP", "CASH-SECURED"],
        when: "You want to own the stock at a lower price, or earn premium with the obligation to buy at the strike.",
        payoff: "You collect premium upfront. If the stock stays above the strike, the put expires worthless and you keep the premium. If it falls below the strike, you are assigned shares at an effective cost of (strike − premium received).",
        maxLoss: "(Strike × 100 per contract) − premium received, less the premium. Severe if the stock goes to zero.",
        maxGain: "Premium received. Capped.",
        dte: "21–45 DTE is typical. Shorter DTE earns less premium but has faster time decay.",
        mistakes: "Selling puts on stocks you wouldn't actually want to own, ignoring the full notional capital at risk, selling too many contracts relative to available cash.",
      },
      {
        name: "Vertical Spread (Debit)",
        aliases: ["DEBIT SPREAD", "BULL CALL", "BEAR PUT", "VERTICAL"],
        when: "You have a directional view but want to reduce premium cost by selling a further-out-of-the-money option against the one you buy.",
        payoff: "Maximum profit between the two strikes; maximum loss is the net debit paid. Both outcomes are fully defined at entry.",
        maxLoss: "Net debit paid. Cannot lose more.",
        maxGain: "Width of the spread − net debit paid.",
        dte: "30–60 DTE. Allows time for the move while theta works more slowly.",
        mistakes: "Choosing strike widths too narrow (limits profit potential), not understanding that debit spreads still need the underlying to move.",
      },
      {
        name: "Vertical Spread (Credit)",
        aliases: ["CREDIT SPREAD", "BULL PUT", "BEAR CALL"],
        when: "You have a directional or neutral view and want to sell premium with defined risk.",
        payoff: "Profit is the net credit received if the spread expires worthless. Loss occurs if the underlying moves through the short strike.",
        maxLoss: "Width of the spread − net credit received.",
        maxGain: "Net credit received.",
        dte: "21–45 DTE is common for premium sellers.",
        mistakes: "Closing too early when the spread is near max profit (small remaining credit isn't worth the commissions risk), legging into spreads instead of placing as a single order.",
      },
      {
        name: "Iron Condor",
        aliases: ["IRON CONDOR", "CONDOR"],
        when: "You expect the underlying to remain range-bound; you sell both a call spread and a put spread around the current price.",
        payoff: "Maximum profit if the stock finishes between the two short strikes at expiration. Losses on either wing if the stock moves outside the range.",
        maxLoss: "Width of the wider wing − total credit received.",
        maxGain: "Total net credit received.",
        dte: "30–45 DTE; typically managed at 50% of max profit.",
        mistakes: "Sizing too large (multiple wings of risk feel small individually but add up), not managing when one side is tested.",
      },
      {
        name: "The Wheel",
        aliases: ["WHEEL"],
        when: "A systematic strategy: sell cash-secured puts on a stock you'd like to own; if assigned, sell covered calls until called away, then repeat.",
        payoff: "Generates premium income in sideways or rising markets. In a declining market, the cumulative premium may not offset the loss in the assigned stock position.",
        maxLoss: "Full cost of the assigned stock position minus all premiums collected over the cycle. Severe if the underlying trends sharply lower.",
        maxGain: "Cumulative premium income over multiple cycles. Gains are capped and income-like.",
        dte: "21–45 DTE for CSP phase; 21–30 DTE for covered call phase.",
        mistakes: "Running the wheel on stocks that decline significantly after assignment, treating it as 'free money' without accounting for the opportunity cost vs. simply owning the stock.",
      },
    ];

    return (
      <div>
        <Prose>
          <p>
            Each of these strategies is a defined payoff structure — a contract. Understanding the
            exact conditions under which it wins, loses, and at what magnitude is not optional; it
            is the minimum baseline for using the strategy responsibly.
          </p>
        </Prose>

        {strategies.map((s) => {
          const stat = findStat(s.aliases);
          return (
            <div key={s.name} className="mb-8">
              <div className="flex items-start gap-3 mb-2 flex-wrap">
                <H3>{s.name}</H3>
                {stat ? (
                  <div className="flex gap-2 mt-6 flex-wrap">
                    <Badge tone="brass">You&apos;ve run this {stat.count}×</Badge>
                    {stat.winRatePct != null && (
                      <Badge tone={stat.winRatePct >= 50 ? "gain" : "loss"}>
                        Win rate: {stat.winRatePct}%
                      </Badge>
                    )}
                    <Badge tone={stat.realizedCents >= 0 ? "gain" : "loss"}>
                      P&L: <Money cents={stat.realizedCents} colored />
                    </Badge>
                  </div>
                ) : (
                  <div className="mt-6">
                    <Badge tone="neutral">Not yet traded</Badge>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="card px-4 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-faint mb-1">When to Use</div>
                  <div className="text-muted">{s.when}</div>
                </div>
                <div className="card px-4 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-faint mb-1">Payoff Shape</div>
                  <div className="text-muted">{s.payoff}</div>
                </div>
                <div className="card px-4 py-3 border-l-2 border-l-loss">
                  <div className="text-[10px] uppercase tracking-widest text-loss mb-1">Max Loss</div>
                  <div className="text-muted">{s.maxLoss}</div>
                </div>
                <div className="card px-4 py-3 border-l-2 border-l-gain">
                  <div className="text-[10px] uppercase tracking-widest text-gain mb-1">Max Gain</div>
                  <div className="text-muted">{s.maxGain}</div>
                </div>
                <div className="card px-4 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-faint mb-1">Typical DTE</div>
                  <div className="text-muted">{s.dte}</div>
                </div>
                <div className="card px-4 py-3 border-l-2 border-l-brass">
                  <div className="text-[10px] uppercase tracking-widest text-brass mb-1">Common Mistakes</div>
                  <div className="text-muted">{s.mistakes}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  },
};

/* 8. How Professionals Think */
const howProfessionalsThink: Module = {
  slug: "how-professionals-think",
  title: "How Quantitative Traders Think",
  kicker: "Market Literacy",
  minutes: 9,
  hook: "What systematic trading firms actually do — and the honest accounting of what retail traders can and can't replicate.",
  render(_data) {
    return (
      <div>
        <Prose>
          <p>
            The word "algorithm" has taken on mythological dimensions in retail trading circles —
            a black box that prints money, operated by people with math PhDs and proprietary data
            feeds. The reality is more structured and, in many ways, more understandable. What
            systematic traders actually do is the rigorous application of a few core ideas that
            any thoughtful retail trader can understand, even if they can't fully replicate the
            infrastructure.
          </p>
        </Prose>

        <H2>Edge and Expectancy</H2>
        <Prose>
          <p>
            A <strong className="text-foreground">trading edge</strong> is a quantifiable,
            persistent advantage: a signal that predicts future price movement better than chance,
            after accounting for all transaction costs, slippage, and market impact.{" "}
            <strong className="text-foreground">Expectancy</strong> is the average outcome per
            dollar risked across all trades in a strategy:{" "}
            <code className="text-brass-bright text-xs">E = (win rate × avg win) − (loss rate × avg loss)</code>.
          </p>
          <p>
            Positive expectancy is necessary but not sufficient: a strategy with a small edge on
            many trades can be destroyed by a single sizing error or by execution slippage that
            erodes the expected value. Professional shops are obsessive about measuring both the
            edge and the transaction cost — many strategies that appear to have edge on paper
            are unprofitable net of realistic execution costs.
          </p>
        </Prose>

        <H2>Regime Awareness</H2>
        <Prose>
          <p>
            Markets are not stationary: an edge that works in trending, low-volatility environments
            often fails in choppy or crisis conditions, and vice versa. Quantitative firms spend
            enormous effort classifying the current{" "}
            <strong className="text-foreground">market regime</strong> — the combination of trend,
            volatility, correlation, and liquidity conditions — and sizing or activating strategies
            accordingly.
          </p>
          <p>
            For retail traders, a simpler version of regime awareness is useful: know whether you're
            in a trend-following or mean-reverting environment, whether volatility is elevated or
            compressed, and whether correlations are high (risk-off, everything moves together) or
            low (stock-picking matters). This context doesn't require a machine-learning model —
            it requires reading VIX, observing sector correlations, and paying attention to the
            macro narrative.
          </p>
        </Prose>
        <InfoBox>
          The Patterns module in this app shows your SPY/VIX regime classification for each
          trading day. Reviewing which regimes coincided with your best and worst outcomes
          is a practical first step in regime awareness without building a model.
        </InfoBox>

        <H2>What Machine Learning Actually Does</H2>
        <Prose>
          <p>
            Quantitative firms that use ML for trading are typically doing one or more of: (1)
            feature engineering — constructing predictive signals from raw data; (2) regime
            classification — labeling market conditions to route strategies; (3) risk modeling —
            estimating covariance matrices and position-level VaR; (4) execution optimization —
            minimizing market impact on large orders.
          </p>
          <p>
            Almost none of this is "the model decides what to buy." The model is one component in
            a heavily-engineered pipeline with human oversight at every stage. The "AI trading
            bot" framing vastly oversimplifies the actual structure of institutional quant desks.
          </p>
        </Prose>

        <H2>Overfitting: The Silent Killer of Backtests</H2>
        <Prose>
          <p>
            <strong className="text-foreground">Overfitting</strong> occurs when a model is tuned
            so precisely to historical data that it captures random noise rather than real
            structure. Every backtest has this problem to some degree: the more parameters you
            optimize, the more you risk building a system that only works on the historical data
            you tested it on.
          </p>
          <p>
            Professional shops counter overfitting with strict train/test splits, walk-forward
            validation, transaction cost assumptions generous enough to be pessimistic,
            and — crucially — a prior expectation that any given strategy should have a plausible
            mechanistic reason to work. If your backtest doesn't include a causal story,
            the results are suspect.
          </p>
        </Prose>

        <H2>Why Process Beats Prediction</H2>
        <Prose>
          <p>
            Markets are fundamentally hard to predict: price changes integrate the collective
            beliefs of millions of participants, many of them with information advantages,
            faster data, and better models. The retail trader cannot out-predict a hedge fund.
          </p>
          <p>
            What is achievable: a consistent, documented process that eliminates avoidable errors —
            emotional sizing, revenge trading, undisciplined exits, ignoring defined risk
            parameters. Process discipline produces outcomes that are better than random in the
            long run, even without a statistical edge in stock selection, because it prevents
            the tail events (blowups) that permanently impair capital.
          </p>
        </Prose>

        <PullQuote source="General principle in professional trading">
          "Being right 60% of the time means nothing if the 40% of losses are twice the size of
          the wins. Edge is about the ratio, not just the frequency."
        </PullQuote>

        <H2>Journaling as a Feedback Loop</H2>
        <Prose>
          <p>
            Professional trading firms have extensive attribution systems: after every trade closes,
            they can decompose the P&L into components — was the gain from the model signal,
            from luck, from execution, from a macro tailwind? This is the quantitative equivalent
            of a trading journal.
          </p>
          <p>
            The Journal feature in this app serves this function for your individual trades.
            The practice that matters is writing entries not just when something goes wrong, but
            when something goes right — to distinguish process-driven wins from outcome-driven
            ones. Over time, this creates a genuine feedback loop: you build a dataset of your
            own decisions, their context, and their outcomes.
          </p>
        </Prose>

        <H2>What Retail Can Replicate</H2>
        <Prose>
          <ul className="list-disc pl-5 space-y-1">
            <li>Defined risk per trade, documented before entry</li>
            <li>Written reasons for every position, reviewed after close</li>
            <li>Consistent strategy execution rather than style-switching</li>
            <li>Awareness of regime context at time of entry</li>
            <li>Systematic review of win/loss patterns across strategy types</li>
          </ul>
        </Prose>
        <Prose>
          <p>
            What retail cannot replicate: co-located execution, proprietary datasets, cross-asset
            correlation modeling at institutional scale, or the ability to influence price.
            Being honest about this boundary is itself a professional behavior.
          </p>
        </Prose>
      </div>
    );
  },
};

/* 9. Principles (Dalio) */
const principlesDalio: Module = {
  slug: "principles-dalio",
  title: "Radical Transparency with Yourself",
  kicker: "Mental Models",
  minutes: 8,
  hook: "Ray Dalio's published ideas on radical transparency, pain as a teacher, and diversification — applied to your own trading mirror.",
  render(data) {
    const holdings = data.overview.holdings.filter((h) => !h.isMoneyMarket && h.marketValueCents != null && h.marketValueCents > 0);
    const totalMV = holdings.reduce((s, h) => s + (h.marketValueCents ?? 0), 0);
    const topHolding = holdings[0] ?? null;
    const topPct = topHolding && totalMV > 0 ? ((topHolding.marketValueCents ?? 0) / totalMV * 100).toFixed(1) : null;
    const top3Pct = totalMV > 0
      ? (holdings.slice(0, 3).reduce((s, h) => s + (h.marketValueCents ?? 0), 0) / totalMV * 100).toFixed(1)
      : null;

    return (
      <div>
        <Prose>
          <p>
            Ray Dalio founded Bridgewater Associates and has written extensively about the mental
            models underlying both investing and decision-making more broadly — most accessibly in
            his 2017 book <em>Principles</em> and in public discussions of his All Weather
            portfolio concept. These ideas were developed and published over decades; what follows
            applies them to the specific context of personal trading psychology. All attributed
            ideas are from his public writings and interviews.
          </p>
        </Prose>

        <H2>Radical Transparency with Yourself</H2>
        <Prose>
          <p>
            In <em>Principles</em>, Dalio describes radical transparency as the practice of
            "not allowing yourself or anyone else to hide their mistakes, weaknesses, or
            bad opinions." In an institutional context, this means recorded meetings, recorded
            debate, and public accountability for every bad call.
          </p>
          <p>
            For a solo trader, radical transparency takes an inward form: the willingness to look
            at the actual numbers without narrative softening — to see a 40% loss rate not as
            "bad luck" or "the market was weird" but as a measurement of how well your process
            works. This application is that system. The data is your record; it doesn't rationalize
            or excuse. Engaging with it honestly is the practice.
          </p>
        </Prose>
        <InfoBox>
          This app is your radical transparency instrument: every position, every entry and exit,
          every wash sale, every cluster sell in a panic — recorded without narrative. The
          patterns it shows are not indictments. They are data.
        </InfoBox>

        <H2>Pain + Reflection = Progress</H2>
        <Prose>
          <p>
            Dalio's most-cited formula, from <em>Principles</em>, is: pain + reflection = progress.
            "Every time you are in pain, there is a potential learning lesson." For traders, the
            pain arrives predictably: premature exits, oversized positions, revenge trades after
            losses. The formula is not about avoiding pain — it's about treating each loss as a
            source of information if, and only if, you examine it.
          </p>
          <p>
            The Wins & Tuition Ledger in this app is built on exactly this idea: every losing trade
            entered with a written reflection is worth more than the loss cost, if the reflection
            is honest. The pattern-recognition features exist to amplify the signal from that
            reflection over time.
          </p>
        </Prose>

        <H2>Diversification: "The Holy Grail of Investing"</H2>
        <Prose>
          <p>
            Dalio has publicly described diversification as the "Holy Grail of investing" — the
            one free lunch in finance. His published research on the All Weather concept suggests
            that holding uncorrelated assets can reduce portfolio volatility significantly without
            proportionally reducing expected returns. The key word is <em>uncorrelated</em>:
            holding 20 tech stocks is not diversification; holding assets whose performance is
            driven by different economic forces is.
          </p>
        </Prose>

        {holdings.length > 0 ? (
          <>
            <H2>Your Concentration</H2>
            <Prose>
              <p>
                Your current portfolio holds{" "}
                <strong className="text-foreground">{holdings.length}</strong> position
                {holdings.length !== 1 ? "s" : ""}.
                {topHolding && topPct && (
                  <>
                    {" "}Your largest position —{" "}
                    <span className="text-foreground font-mono">{topHolding.symbol}</span> — represents{" "}
                    <span className="text-brass-bright num">{topPct}%</span> of your total market value.
                  </>
                )}
                {top3Pct && holdings.length >= 3 && (
                  <>
                    {" "}Your top three positions account for{" "}
                    <span className="text-brass-bright num">{top3Pct}%</span>.
                  </>
                )}
              </p>
              <p>
                Dalio's framework would ask: are these positions driven by different economic
                forces? Do some do well in inflation, others in deflation, others in growth,
                others in contraction? Concentration itself is not a flaw — it reflects
                conviction — but it should be intentional and sized with knowledge of what
                scenario causes all positions to move against you simultaneously.
              </p>
            </Prose>
          </>
        ) : (
          <>
            <H2>Your Concentration</H2>
            <Empty>Import your holdings to see a concentration analysis here.</Empty>
          </>
        )}

        <H2>Separating Ego from Being Right</H2>
        <Prose>
          <p>
            One of Dalio's central principles is the separation of self-worth from the accuracy
            of any particular belief. "Being wrong is acceptable; being wrong and not reflecting
            on it is not." In trading, ego attachment to a position is among the most expensive
            cognitive errors: it manifests as holding a loser too long ("I'm not wrong, the market
            is"), averaging down without a thesis update, or refusing to take a small loss because
            to do so would be to admit the original analysis was flawed.
          </p>
          <p>
            The discipline Dalio describes — being "radically open-minded" — means actively seeking
            evidence against your own positions, not just evidence for them. For a trader this
            means: before adding to a losing position, write down the specific new information that
            makes the original thesis still valid. If you can't write it down, the position is ego,
            not thesis.
          </p>
        </Prose>

        <H2>Writing Your Own Principles</H2>
        <Prose>
          <p>
            Dalio documents his decision-making rules in writing — hundreds of principles that were
            refined over decades and eventually published. The act of writing forces precision: a
            vague feeling ("I usually sell too early") becomes a testable rule ("I will not close
            a position at less than 50% of max profit when IV is still elevated").
          </p>
          <p>
            The Journal in this app is the right place to draft your own. Not inspirational
            statements — operational rules, drawn from observed patterns in your actual trade
            history. The Patterns module shows you where your process is leaking; the Journal is
            where you turn those observations into commitments.
          </p>
        </Prose>

        <PullQuote source="Ray Dalio, Principles (2017)">
          "Pain + Reflection = Progress. Embrace pain rather than avoid it, as the lessons you learn
          will help you avoid making the same mistakes again."
        </PullQuote>

        <Prose>
          <p>
            <em className="text-faint text-xs">
              Ideas in this module are drawn from Dalio's publicly available writings, including{" "}
              <em>Principles: Life and Work</em> (2017) and his published research on the All Weather
              concept. No proprietary Bridgewater material is referenced.
            </em>
          </p>
        </Prose>
      </div>
    );
  },
};

/* ============================================================= EXPORT ==== */

export const modules: Module[] = [
  washSales,
  lotAccounting,
  optionsGreeks,
  positionSizing,
  iraEarlyDistributions,
  cashBuffer,
  strategyLibrary,
  howProfessionalsThink,
  principlesDalio,
];
