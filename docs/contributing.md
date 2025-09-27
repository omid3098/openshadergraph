---
title: Contributing
---

# Contributing

Thanks for your interest! Please open an issue or pull request on the repository.

Before submitting changes, ensure the local gates pass:

```bash
bun run lint
bun run test
# optional
bun x tsc -p tsconfig.json --noEmit
```

For docs changes, run:

```bash
bun run docs:dev
# or
bun run docs:build
```
