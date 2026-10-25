import { type SubmitEvent, useState } from "react";
import { checkUrl, type PredictionResponse } from "./services/api";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const EXAMPLES = [
  { label: "github.com", value: "https://github.com" },
  { label: "wikipedia.org", value: "https://www.wikipedia.org" },
  {
    label: "Fake PayPal login",
    value: "http://secure-login.paypal.verify-account.example.tk/update",
  },
];

const STEPS = [
  {
    title: "Enter a URL",
    text: "Paste any link you received by email, SMS or chat. Nothing is opened or visited.",
  },
  {
    title: "Structure is analyzed",
    text: "The URL is broken down into measurable signals: length, subdomains, hyphens, digits, keywords and more.",
  },
  {
    title: "Model gives a verdict",
    text: "A trained Random Forest classifier returns a phishing probability and the patterns behind it.",
  },
];

type Tone = {
  title: string;
  level: string;
  text: string;
  stroke: string;
  card: string;
  badge: string;
  dot: string;
};

const TONES: Record<"safe" | "medium" | "high", Tone> = {
  safe: {
    title: "Likely Safe",
    level: "Low risk",
    text: "text-emerald-400",
    stroke: "stroke-emerald-400",
    card: "border-emerald-500/20 bg-emerald-500/[0.04]",
    badge: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    dot: "bg-emerald-400",
  },
  medium: {
    title: "Suspicious",
    level: "Medium risk",
    text: "text-amber-400",
    stroke: "stroke-amber-400",
    card: "border-amber-500/20 bg-amber-500/[0.04]",
    badge: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    dot: "bg-amber-400",
  },
  high: {
    title: "Likely Phishing",
    level: "High risk",
    text: "text-red-400",
    stroke: "stroke-red-400",
    card: "border-red-500/20 bg-red-500/[0.04]",
    badge: "bg-red-500/10 text-red-300 ring-red-500/30",
    dot: "bg-red-400",
  },
};

function getTone(result: PredictionResponse): Tone {
  if (result.label !== "phishing") return TONES.safe;
  return result.probability >= 0.85 ? TONES.high : TONES.medium;
}

/* ------------------------------------------------------------------ */
/* Icons (inline SVG, no extra dependencies)                           */
/* ------------------------------------------------------------------ */

type IconProps = { className?: string };

function ShieldIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 4 6v6c0 4.5 3.2 8.2 8 9 4.8-.8 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SearchIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function AlertIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function CopyIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Risk gauge                                                          */
/* ------------------------------------------------------------------ */

function RiskGauge({ percent, tone }: { percent: number; tone: Tone }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div
      className="relative h-36 w-36 shrink-0"
      role="img"
      aria-label={`Phishing probability ${percent} percent`}
    >
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-slate-800"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${tone.stroke} transition-[stroke-dashoffset] duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums ${tone.text}`}>
          {percent}%
        </span>
        <span className="text-[11px] uppercase tracking-wider text-slate-500">
          Phishing
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<PredictionResponse[]>([]);

  async function analyze(value: string) {
    const trimmedUrl = value.trim();

    if (!trimmedUrl) {
      setError("Please enter a URL to analyze.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await checkUrl(trimmedUrl);
      setResult(data);
      setHistory((prev) =>
        [data, ...prev.filter((item) => item.url !== data.url)].slice(0, 5),
      );
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot reach the analysis server. Make sure the backend is running on port 8000."
          : err instanceof Error
            ? err.message
            : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void analyze(url);
  }

  function pickExample(value: string) {
    setUrl(value);
    setError("");
  }

  function reopen(item: PredictionResponse) {
    setUrl(item.url);
    void analyze(item.url);
  }

  async function copyUrl() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const tone = result ? getTone(result) : null;
  const percent = result ? Math.round(result.probability * 100) : 0;
  const isPhishing = result?.label === "phishing";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(37,99,235,0.18),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 sm:px-8">
        {/* Navbar */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/30">
              <ShieldIcon />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              PhishGuard
            </span>
          </div>

          <span className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Machine learning URL analysis
          </span>
        </nav>

        {/* Hero */}
        <header className="pb-10 pt-10 text-center sm:pt-14">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Is that link{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              safe to open?
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Paste a URL and get an instant phishing risk score, with the
            suspicious patterns explained. The link is analyzed as text and is
            never visited.
          </p>
        </header>

        {/* Analyzer card */}
        <main className="flex-1">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
            <form onSubmit={handleSubmit} noValidate>
              <label
                htmlFor="url"
                className="mb-3 block text-sm font-medium text-slate-300"
              >
                URL to analyze
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    id="url"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/login"
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-12 pr-4 font-mono text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Analyzing…
                    </>
                  ) : (
                    "Analyze URL"
                  )}
                </button>
              </div>

              {/* Examples */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Try an example:</span>
                {EXAMPLES.map((example) => (
                  <button
                    key={example.value}
                    type="button"
                    onClick={() => pickExample(example.value)}
                    disabled={loading}
                    className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </form>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </section>

          {/* Result */}
          <div aria-live="polite">
            {result && tone && !loading && (
              <section
                className={`animate-fade-up mt-6 overflow-hidden rounded-2xl border ${tone.card}`}
              >
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
                    <RiskGauge percent={percent} tone={tone} />

                    <div className="flex-1">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tone.badge}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                        />
                        {tone.level}
                      </span>

                      <h2 className={`mt-3 text-3xl font-bold ${tone.text}`}>
                        {tone.title}
                      </h2>

                      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                        {isPhishing
                          ? "This URL shows structural patterns commonly seen in phishing links. Avoid entering credentials or personal details."
                          : "This URL looks structurally similar to legitimate links. Always stay cautious with unexpected messages."}
                      </p>
                    </div>
                  </div>

                  {/* Analyzed URL */}
                  <div className="mt-7 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Analyzed URL
                      </p>
                      <button
                        type="button"
                        onClick={copyUrl}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                      >
                        {copied ? (
                          <CheckIcon className="h-3.5 w-3.5" />
                        ) : (
                          <CopyIcon className="h-3.5 w-3.5" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="break-all font-mono text-sm text-slate-300">
                      {result.url}
                    </p>
                  </div>
                </div>

                {/* Signals */}
                <div className="border-t border-slate-800/80 bg-slate-950/30 p-6 sm:p-8">
                  <h3 className="font-semibold text-white">Detected signals</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Patterns found in the structure of the URL.
                  </p>

                  {result.reasons.length > 0 ? (
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                      {result.reasons.map((reason, index) => (
                        <li
                          key={`${reason}-${index}`}
                          className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                              isPhishing
                                ? "bg-red-500/10 text-red-400"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {isPhishing ? (
                              <AlertIcon className="h-3 w-3" />
                            ) : (
                              <CheckIcon className="h-3 w-3" />
                            )}
                          </span>
                          <span className="text-sm text-slate-300">
                            {reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                      No notable suspicious patterns were detected.
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Recent checks */}
          {history.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-slate-400">
                Recent checks
              </h3>
              <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
                {history.map((item) => {
                  const itemTone = getTone(item);
                  return (
                    <li key={item.url}>
                      <button
                        type="button"
                        onClick={() => reopen(item)}
                        disabled={loading}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/50 disabled:opacity-60"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${itemTone.dot}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
                          {item.url}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-semibold ${itemTone.text}`}
                        >
                          {itemTone.title} ·{" "}
                          {Math.round(item.probability * 100)}%
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* How it works */}
          <section className="mt-16">
            <h2 className="text-center text-2xl font-bold tracking-tight">
              How it works
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-sm font-bold text-blue-400 ring-1 ring-inset ring-blue-500/20">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-800/80 py-8 text-center">
          <p className="mx-auto max-w-2xl text-xs leading-5 text-slate-500">
            PhishGuard analyzes URL text and structure only. It does not visit
            the website, and results are a prediction, not a guarantee that a
            link is safe or malicious. When in doubt, don't click.
          </p>
          <p className="mt-3 text-xs text-slate-600">
            Built with FastAPI · scikit-learn · React
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
