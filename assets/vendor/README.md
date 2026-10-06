# Browser rendering dependencies

- marked 15.0.12 — Markdown rendering, MIT.
- DOMPurify 3.2.7 — HTML sanitization, Apache-2.0 OR MPL-2.0.
- KaTeX 0.16.22 — math rendering, MIT; included fonts retain upstream licenses.

Downloaded from npm without running lifecycle scripts. Markdown is sanitized before insertion; KaTeX uses `trust: false`. These files provide rendering only, not an AI service. No external CDN is required. Upstream license notices are retained.
