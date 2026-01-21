# Contributing to create-bhvr

First off, thank you for considering contributing to `bhvr`! This is a true open source project and we welcome community ideas and contributions. In order to keep things clean please follow the contributing guidelines below.

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please make sure the bug has not already been reported by searching on GitHub under [Issues](https://github.com/stevedylandev/bhvr/issues). If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/stevedylandev/bhvr/issues/new). Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

If you have an idea for an enhancement, please make sure the enhancement has not already been suggested by searching on GitHub under [Issues](https://github.com/stevedylandev/bhvr/issues). If you're unable to find an open issue addressing the suggestion, [open a new one](https://github.com/stevedylandev/bhvr/issues/new). Be sure to include a **title and clear description** of the enhancement you're suggesting.

### Submitting a Pull Request

1.  Fork the repository and create your branch from `main`.
2.  Run `bun install` to install the dependencies.
3.  Make your changes.
4.  Run `bun run build` to make sure your changes build correctly.
5.  Issue that pull request!

## Developer hooks

This repository includes a Husky pre-commit hook that keeps `README.md` in sync with the canonical Mermaid sources in `docs/diagrams/`.

- After cloning, run `bun install` (or `npm install`) to trigger the `prepare` script which runs `husky install` and sets up the hooks.
- The pre-commit hook runs `bash scripts/sync-diagrams.sh` and will automatically stage `README.md` if it changes.
- You can run the sync manually at any time:

```bash
bun run sync:diagrams
```

If you prefer not to use Husky, you can still run the sync script manually as part of your workflow.

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
