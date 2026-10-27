# ROT — "Rest or Train" training-readiness app

An **original** training-readiness app: given your recovery and training-load data, it recommends
**train hard / go easy / rest** with a transparent, explainable readiness score.

> **Clean-room / legal note.** This is an independent implementation built from *publicly documented
> sports-science methods* (e.g. CTL/ATL/TSB, acute:chronic workload ratio, HRV-guided training,
> Banister TRIMP). It is **not** a copy or reverse-engineering of any third-party app — no third-party
> code, assets, or branding are used. See [`docs/00-scope.md`](docs/00-scope.md).

## Status

Early scaffold. Work proceeds in phases with owner checkpoints — see [`docs/`](docs/).

## Project layout

```
packages/engine   # pure, testable decision engine (no UI, no I/O)
apps/web          # minimal daily check-in -> recommendation web UI (added in Phase 4)
docs/             # scope, research, behaviour spec, architecture, roadmap, validation
references/       # public-source notes & citations
```

## Develop

```bash
npm install
npm test          # run engine unit + golden tests
npm run typecheck
npm run dev        # launch the web app (once apps/web exists)
```

Requires Node.js ≥ 22.19.

## License

MIT (see package.json). Original work only.
