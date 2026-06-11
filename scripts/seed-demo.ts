/**
 * Seeds a demo database (default: data/demo.db) with synthetic two-book data.
 * Run the app against it with: TRADER_MIRROR_DB=data/demo.db npm run dev
 */

import { getDb } from "../src/lib/db/client";
import { generateDemoEquity, generateDemoOptions } from "../src/lib/demo/seed";
import { ingestParseResult } from "../src/lib/ingest/ingest";
import { rebuildDerived } from "../src/lib/engine/rebuild";
import { loadBundledMarketData } from "../src/lib/market/market";
import { designations, settings } from "../src/lib/db/schema";

if (!process.env.TRADER_MIRROR_DB) {
  process.env.TRADER_MIRROR_DB = "data/demo.db";
}

const db = getDb();
console.log(`Seeding demo data into ${process.env.TRADER_MIRROR_DB}`);

loadBundledMarketData(db);

const equity = generateDemoEquity();
const options = generateDemoOptions();

const eq = ingestParseResult(
  {
    db, fileName: "demo-equity.seed", fileContent: JSON.stringify(equity.transactions),
    accountId: "demo:fidelity", accountLabel: "Demo Fidelity (equity)", broker: "demo", book: "equity",
  },
  equity,
);
const op = ingestParseResult(
  {
    db, fileName: "demo-options.seed", fileContent: JSON.stringify(options.transactions),
    accountId: "demo:thinkorswim", accountLabel: "Demo thinkorswim (options)", broker: "demo", book: "options",
  },
  options,
);

db.insert(designations)
  .values({ symbol: "AMC", bucket: "belief", note: "Demo belief bucket", createdAt: new Date().toISOString() })
  .onConflictDoNothing()
  .run();
db.insert(settings).values({ key: "demo", value: "1" }).onConflictDoNothing().run();

const rebuilt = rebuildDerived(db);
console.log(
  `equity imported=${eq.imported}, options imported=${op.imported}; lots=${rebuilt.openLots}, closures=${rebuilt.closures}, optionPositions=${rebuilt.optionPositions}`,
);
