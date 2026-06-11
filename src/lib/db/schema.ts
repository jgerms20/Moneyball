import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* --------------------------------- core --------------------------------- */

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(), // e.g. "fidelity:Z09-396938"
  broker: text("broker").notNull(), // fidelity | schwab | thinkorswim | demo
  label: text("label").notNull(),
  kind: text("kind").notNull().default("brokerage"), // brokerage | ira
  /** personality bucket for "Two Traders": equity | options */
  book: text("book").notNull().default("equity"),
  createdAt: text("created_at").notNull(),
});

export const importFiles = sqliteTable(
  "import_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileName: text("file_name").notNull(),
    source: text("source").notNull(),
    sha256: text("sha256").notNull(),
    accountId: text("account_id"),
    importedAt: text("imported_at").notNull(),
    rowsImported: integer("rows_imported").notNull().default(0),
    rowsDeduped: integer("rows_deduped").notNull().default(0),
    rowsSkipped: integer("rows_skipped").notNull().default(0),
    warnings: text("warnings"), // JSON string[]
  },
  (t) => [uniqueIndex("import_files_sha_idx").on(t.sha256)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id").notNull(),
    importFileId: integer("import_file_id"),
    source: text("source").notNull(),
    /** natural-key hash for cross-file dedupe */
    txKey: text("tx_key").notNull(),
    /** ordinal among identical keys within one file (real duplicate trades survive) */
    keyOrdinal: integer("key_ordinal").notNull().default(0),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    execTime: text("exec_time"),
    settleDate: text("settle_date"),
    type: text("type").notNull(),
    action: text("action").notNull(),
    symbol: text("symbol"),
    cusip: text("cusip"),
    description: text("description"),
    // option fields (null for equities/cash)
    occKey: text("occ_key"),
    underlying: text("underlying"),
    expiry: text("expiry"),
    strikeMicro: integer("strike_micro"),
    right: text("right"), // C | P
    multiplier: integer("multiplier"),
    qtyMicro: integer("qty_micro"),
    priceMicro: integer("price_micro"),
    amountCents: integer("amount_cents"),
    feesCents: integer("fees_cents"),
    commissionCents: integer("commission_cents"),
    cashBalanceCents: integer("cash_balance_cents"),
    strategyLabel: text("strategy_label"),
    raw: text("raw"), // JSON of the source row
  },
  (t) => [
    uniqueIndex("tx_dedupe_idx").on(t.accountId, t.txKey, t.keyOrdinal),
    index("tx_account_date_idx").on(t.accountId, t.date),
    index("tx_symbol_idx").on(t.symbol),
    index("tx_type_idx").on(t.type),
  ],
);

export const skippedRows = sqliteTable("skipped_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importFileId: integer("import_file_id").notNull(),
  lineNo: integer("line_no").notNull(),
  raw: text("raw").notNull(),
  reason: text("reason").notNull(),
});

/* ------------------------------ derived state ---------------------------- */

export const lots = sqliteTable(
  "lots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id").notNull(),
    symbol: text("symbol").notNull(),
    openDate: text("open_date").notNull(),
    openTxId: integer("open_tx_id"),
    qtyMicro: integer("qty_micro").notNull(),
    remainingMicro: integer("remaining_micro").notNull(),
    costCents: integer("cost_cents"), // null => basis unknown (transfer in)
    costRemainingCents: integer("cost_remaining_cents"),
    isMoneyMarket: integer("is_money_market", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("lots_account_symbol_idx").on(t.accountId, t.symbol)],
);

export const lotClosures = sqliteTable(
  "lot_closures",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id").notNull(),
    symbol: text("symbol").notNull(),
    openDate: text("open_date"), // null for orphan sells (no known lot)
    closeDate: text("close_date").notNull(),
    closeTxId: integer("close_tx_id"),
    qtyMicro: integer("qty_micro").notNull(),
    proceedsCents: integer("proceeds_cents").notNull(),
    basisCents: integer("basis_cents"),
    gainCents: integer("gain_cents"),
    holdingDays: integer("holding_days"),
    orphan: integer("orphan", { mode: "boolean" }).notNull().default(false),
    isMoneyMarket: integer("is_money_market", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("closures_account_idx").on(t.accountId, t.closeDate),
    index("closures_symbol_idx").on(t.symbol),
  ],
);

export const optionPositions = sqliteTable(
  "option_positions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id").notNull(),
    occKey: text("occ_key").notNull(),
    underlying: text("underlying").notNull(),
    expiry: text("expiry").notNull(),
    strikeMicro: integer("strike_micro").notNull(),
    right: text("right").notNull(),
    direction: text("direction").notNull(), // long | short
    openedAt: text("opened_at").notNull(),
    closedAt: text("closed_at"),
    peakContracts: integer("peak_contracts").notNull(),
    openPremiumCents: integer("open_premium_cents").notNull(), // signed cash at opens
    closePremiumCents: integer("close_premium_cents").notNull(), // signed cash at closes
    realizedCents: integer("realized_cents"),
    feesCents: integer("fees_cents").notNull().default(0),
    status: text("status").notNull(), // open | closed
    outcome: text("outcome"), // closed | expired | assigned | exercised
    dteAtOpen: integer("dte_at_open"),
    strategyLabel: text("strategy_label"),
  },
  (t) => [index("optpos_account_idx").on(t.accountId, t.openedAt)],
);

export const optionFills = sqliteTable("option_fills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  positionId: integer("position_id").notNull(),
  txId: integer("tx_id").notNull(),
  role: text("role").notNull(), // open | close | expire | assign | exercise
});

/* ------------------------------- 1099 data ------------------------------- */

export const taxLots = sqliteTable(
  "tax_lots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    year: integer("year").notNull(),
    accountNo: text("account_no"),
    importFileId: integer("import_file_id"),
    description: text("description").notNull(),
    symbol: text("symbol"),
    cusip: text("cusip"),
    qtyMicro: integer("qty_micro").notNull(),
    acquired: text("acquired").notNull(), // ISO date or VARIOUS
    sold: text("sold").notNull(),
    proceedsCents: integer("proceeds_cents").notNull(),
    basisCents: integer("basis_cents"),
    washDisallowedCents: integer("wash_disallowed_cents"),
    gainCents: integer("gain_cents"),
    term: text("term").notNull(),
    basisReported: integer("basis_reported", { mode: "boolean" }).notNull(),
    dedupeKey: text("dedupe_key").notNull(),
  },
  (t) => [
    uniqueIndex("tax_lots_dedupe_idx").on(t.dedupeKey),
    index("tax_lots_year_idx").on(t.year),
  ],
);

export const taxDividends = sqliteTable(
  "tax_dividends",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    year: integer("year").notNull(),
    accountNo: text("account_no"),
    importFileId: integer("import_file_id"),
    description: text("description").notNull(),
    symbol: text("symbol"),
    cusip: text("cusip"),
    date: text("date").notNull(),
    ordinaryCents: integer("ordinary_cents").notNull(),
    qualifiedCents: integer("qualified_cents"),
    dedupeKey: text("dedupe_key").notNull(),
  },
  (t) => [uniqueIndex("tax_div_dedupe_idx").on(t.dedupeKey)],
);

export const taxForms = sqliteTable("tax_forms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year"),
  accountNo: text("account_no"),
  importFileId: integer("import_file_id"),
  form: text("form").notNull(), // consolidated-1099 | 1099-R | 5498
  payload: text("payload").notNull(), // JSON (summary boxes, retirement fields...)
});

/* ------------------------------ market data ------------------------------ */

export const marketDays = sqliteTable(
  "market_days",
  {
    symbol: text("symbol").notNull(), // SPY | QQQ | VIX | SP500_MONTHLY
    date: text("date").notNull(),
    closeMicro: integer("close_micro").notNull(),
    highMicro: integer("high_micro"),
    lowMicro: integer("low_micro"),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.date] })],
);

/* --------------------------- user-authored state ------------------------- */

export const designations = sqliteTable("designations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull().unique(),
  bucket: text("bucket").notNull(), // belief | watch | quality | meme
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const clusterTags = sqliteTable(
  "cluster_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id").notNull(),
    date: text("date").notNull(),
    reason: text("reason").notNull(), // liquidity | consolidation | capitulation | other
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("cluster_tags_idx").on(t.accountId, t.date)],
);

export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  symbol: text("symbol"),
  accountId: text("account_id"),
  kind: text("kind").notNull().default("reflection"), // reflection | thesis | checklist
  title: text("title"),
  body: text("body").notNull(),
  conviction: integer("conviction"), // 1-5
  exitPlan: text("exit_plan"),
  invalidation: text("invalidation"),
  payload: text("payload"), // JSON for checklist answers etc.
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const swotVersions = sqliteTable("swot_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
  payload: text("payload").notNull(), // JSON SWOT with evidence references
});

export const annotations = sqliteTable("annotations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  label: text("label").notNull(),
  body: text("body"),
  kind: text("kind").notNull().default("life"), // life | market | account
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
