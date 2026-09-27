export type SampleMorph = {
  label: string;
  prompt: string;
};

export type SampleScenario = {
  id: string;
  title: string;
  seed: string;
  morphs: SampleMorph[];
};

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: "url_shortener",
    title: "URL shortener API",
    seed: "Build a URL shortener: design the Postgres schema, implement the FastAPI create and resolve endpoints, write pytest tests, and add a CLI to mint links. Start with the schema; the endpoints and tests depend on it, while the CLI can be built in parallel.",
    morphs: [
      { label: "add independent work", prompt: "Also add rate limiting for the create endpoint." },
      {
        label: "add a dependency",
        prompt: "Add a click-analytics endpoint that depends on the create and resolve endpoints.",
      },
      {
        label: "rename / rescope",
        prompt: "Rename the tests work to integration tests, scoped to the resolve endpoint only.",
      },
      { label: "near-duplicate (dedupe)", prompt: "Please add test coverage for the shortener." },
      {
        label: "cancel / extend",
        prompt: "Drop the CLI for now, and extend the schema task with a migration script.",
      },
    ],
  },
  {
    id: "etl_pipeline",
    title: "ETL data pipeline",
    seed: "Build an ETL pipeline that ingests raw CSV events, validates and deduplicates them, loads them into Postgres, and produces a daily summary report. Ingestion comes first; the load depends on validation, and the report depends on the load.",
    morphs: [
      { label: "add independent work", prompt: "Also add structured logging across the pipeline." },
      {
        label: "add a dependency",
        prompt: "Add a data-quality dashboard that depends on the daily summary report.",
      },
      {
        label: "rename / rescope",
        prompt:
          "Rename the load step to upsert into the warehouse and limit it to incremental loads.",
      },
      {
        label: "near-duplicate (dedupe)",
        prompt: "Add deduplication for the incoming events.",
      },
      {
        label: "cancel / extend",
        prompt: "Cancel the reporting work and instead extend validation with schema-drift checks.",
      },
    ],
  },
  {
    id: "analytics_dashboard",
    title: "React analytics dashboard",
    seed: "Build a React analytics dashboard: set up the Vite project and routing, build a metrics API client, create chart components, and wire up a filters bar. The charts depend on the API client; routing and filters can proceed in parallel.",
    morphs: [
      { label: "add independent work", prompt: "Add dark mode theming for the dashboard." },
      {
        label: "add a dependency",
        prompt: "Add a CSV export button that depends on the chart components.",
      },
      {
        label: "rename / rescope",
        prompt:
          "Rename the filters bar to a global date-range picker and scope it to the dashboard header.",
      },
      {
        label: "near-duplicate (dedupe)",
        prompt: "We should also add filtering controls to the dashboard.",
      },
      {
        label: "cancel / extend",
        prompt: "Drop dark mode and instead extend the API client with caching.",
      },
    ],
  },
  {
    id: "web_scraper",
    title: "Web scraper",
    seed: "Build a web scraper: implement an HTTP fetcher with retries, parse listing pages into structured records, store results in SQLite, and add a CLI to run scheduled scrapes. The parser depends on the fetcher; storage and the CLI can run in parallel.",
    morphs: [
      { label: "add independent work", prompt: "Add a user-agent rotation pool." },
      {
        label: "add a dependency",
        prompt: "Add a dedupe stage that depends on the parser.",
      },
      {
        label: "rename / rescope",
        prompt: "Rename the storage work to SQLite export and scope it to JSON export as well.",
      },
      {
        label: "near-duplicate (dedupe)",
        prompt: "Also persist the scraped records to a database.",
      },
      {
        label: "cancel / extend",
        prompt: "Cancel the CLI work and instead extend the fetcher with a politeness delay.",
      },
    ],
  },
  {
    id: "support_bot",
    title: "Support chat bot",
    seed: "Build a support chat bot: design the intent schema, implement a retrieval step over the FAQ corpus, write response generation, and add a CLI REPL. Retrieval depends on the intent schema; generation depends on retrieval; the REPL is parallel.",
    morphs: [
      { label: "add independent work", prompt: "Add conversation logging with redaction." },
      {
        label: "add a dependency",
        prompt: "Add an escalation path that depends on response generation.",
      },
      {
        label: "rename / rescope",
        prompt: "Rename response generation to answer synthesis and scope it to short answers.",
      },
      { label: "near-duplicate (dedupe)", prompt: "Add a way to search the FAQ." },
      {
        label: "cancel / extend",
        prompt: "Drop the CLI REPL and instead extend retrieval with reranking.",
      },
    ],
  },
  {
    id: "cli_todo",
    title: "CLI todo app",
    seed: "Build a CLI todo app: define the task data model, implement add/list/complete commands, write unit tests, and add file persistence. The data model comes first; commands and persistence depend on it; tests follow the commands.",
    morphs: [
      { label: "add independent work", prompt: "Add colored output for the commands." },
      {
        label: "add a dependency",
        prompt: "Add an undo command that depends on the complete command.",
      },
      {
        label: "rename / rescope",
        prompt: "Rename file persistence to a JSON store and add autosave.",
      },
      { label: "near-duplicate (dedupe)", prompt: "Please add tests for the commands." },
      {
        label: "cancel / extend",
        prompt: "Cancel colored output and instead extend the data model with due dates.",
      },
    ],
  },
  {
    id: "static_site",
    title: "Static site generator",
    seed: "Build a static site generator: write a Markdown-to-HTML renderer, a template layer, an asset pipeline, and a build CLI. The renderer comes first; templates depend on it; assets and the CLI are parallel.",
    morphs: [
      { label: "add independent work", prompt: "Add an RSS feed generator." },
      {
        label: "add a dependency",
        prompt: "Add a sitemap step that depends on the renderer.",
      },
      {
        label: "rename / rescope",
        prompt: "Rename the template layer to a layout engine and scope it to HTML pages only.",
      },
      { label: "near-duplicate (dedupe)", prompt: "Also convert Markdown files into HTML." },
      {
        label: "cancel / extend",
        prompt: "Drop the RSS feed and instead extend the asset pipeline with image optimization.",
      },
    ],
  },
  {
    id: "http_cache",
    title: "HTTP cache service",
    seed: "Build an HTTP cache service: design the cache key scheme, implement get/set with TTL, add eviction, and expose a tiny HTTP API. The key scheme is first; get/set depends on it; eviction and the API are parallel.",
    morphs: [
      { label: "add independent work", prompt: "Add metrics counters for hits and misses." },
      {
        label: "add a dependency",
        prompt: "Add a warmup loader that depends on the HTTP API.",
      },
      {
        label: "rename / rescope",
        prompt: "Rename eviction to an LRU eviction policy and scope it to memory only.",
      },
      { label: "near-duplicate (dedupe)", prompt: "We also need TTL expiry on entries." },
      {
        label: "cancel / extend",
        prompt: "Cancel metrics and instead extend get/set with conditional revalidation.",
      },
    ],
  },
  {
    id: "ml_training",
    title: "ML training script",
    seed: "Build an ML training script: prepare and split the dataset, define the model, write the training loop, and add evaluation metrics. Data prep comes first; the model depends on it; training depends on the model; evaluation follows training.",
    morphs: [
      {
        label: "add independent work",
        prompt: "Add a config file loader for hyperparameters.",
      },
      {
        label: "add a dependency",
        prompt: "Add a checkpointing step that depends on the training loop.",
      },
      {
        label: "rename / rescope",
        prompt: "Rename evaluation metrics to a validation report and scope it to the last epoch.",
      },
      { label: "near-duplicate (dedupe)", prompt: "Also add a way to score the trained model." },
      {
        label: "cancel / extend",
        prompt: "Drop checkpointing and instead extend data prep with augmentation.",
      },
    ],
  },
  {
    id: "file_sync",
    title: "File sync tool",
    seed: "Build a file sync tool: compute content hashes, maintain a local index, implement change detection, and add a CLI to sync two folders. Hashing comes first; the index depends on it; change detection depends on the index; the CLI is parallel.",
    morphs: [
      { label: "add independent work", prompt: "Add a dry-run preview mode." },
      {
        label: "add a dependency",
        prompt: "Add conflict resolution that depends on change detection.",
      },
      {
        label: "rename / rescope",
        prompt: "Rename change detection to a diff engine and scope it to modified files only.",
      },
      { label: "near-duplicate (dedupe)", prompt: "Add a way to compare two folders." },
      {
        label: "cancel / extend",
        prompt: "Cancel dry-run and instead extend hashing with chunked hashing.",
      },
    ],
  },
];
