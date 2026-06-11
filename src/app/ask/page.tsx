import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { PageHeader, Section } from "@/components/ui";
import Chat from "@/components/ask/Chat";
import { clearApiKey, saveApiKey } from "./actions";

export const dynamic = "force-dynamic";

export default function AskPage() {
  const stored = getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, "anthropic_api_key"))
    .get();
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || stored?.value);

  return (
    <div>
      <PageHeader
        kicker="optional · claude-powered"
        title="Ask the Mirror"
        subtitle="A conversation with your own record. Questions go to the Anthropic API along with a compact summary of your local data; everything else on this site works without it."
      />
      {hasKey ? (
        <>
          <Chat />
          <form action={clearApiKey} className="mt-4">
            <button className="text-xs text-faint underline hover:text-muted">
              {stored?.value ? "Remove stored API key" : "Key set via environment variable"}
            </button>
          </form>
        </>
      ) : (
        <Section title="Connect a key to begin">
          <form action={saveApiKey} className="card flex max-w-lg flex-col gap-3 p-6">
            <p className="text-sm text-muted">
              Paste an Anthropic API key. It is stored only in this server&apos;s local SQLite
              database, never committed anywhere.
            </p>
            <input
              name="apiKey"
              type="password"
              placeholder="sk-ant-..."
              className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground outline-none focus:border-brass"
            />
            <button className="self-start rounded-md bg-brass px-4 py-2 text-sm font-medium text-background hover:bg-brass-bright">
              Save key
            </button>
          </form>
        </Section>
      )}
    </div>
  );
}
