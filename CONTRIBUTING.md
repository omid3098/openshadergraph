# Contributing to OpenShaderGraph

Thank you for your interest in contributing to OpenShaderGraph! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing Your Changes](#testing-your-changes)
- [Code Style Guidelines](#code-style-guidelines)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Adding New Nodes](#adding-new-nodes)
- [Adding Language Packs](#adding-language-packs)

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Bun** (v1.0 or later) - [Install Bun](https://bun.sh/)
- **Node.js** (v18 or later) - for some tooling compatibility
- **Git** - for version control
- **Python 3** (optional) - for building documentation

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/openshadergraph.git
   cd openshadergraph
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/omid3098/openshadergraph.git
   ```

---

## Development Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Start Development Server

```bash
bun run dev
```

This will:

- Start a build watcher that compiles TypeScript on changes
- Start the Bun server with hot reload on port 3000
- Serve the app at `http://localhost:3000`

### 3. Verify Setup

- Open `http://localhost:3000` in your browser
- You should see the shader graph editor
- Try adding a node and connecting it

### 4. Optional: Setup Documentation

To build and serve documentation locally:

```bash
# Create Python virtual environment (first time only)
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install documentation dependencies
pip install -r requirements.txt

# Serve docs locally
bun run docs:dev
```

---

## Project Structure

```
openshadergraph/
├── src/
│   ├── core/           # Core business logic (framework-agnostic)
│   │   ├── compiler/   # Shader compilation engine
│   │   ├── graph/      # Graph data structures
│   │   ├── schema/     # Data validation (Zod)
│   │   ├── ui/         # UI-agnostic graph operations
│   │   └── types/      # Type definitions
│   ├── components/     # React components
│   ├── ui/             # UI layout and state
│   ├── server/         # Bun server and API handlers
│   └── index.tsx       # Entry point
├── data/
│   ├── nodes/          # Node definitions (JSON)
│   ├── languages/      # Language pack templates
│   └── assets/         # Asset library
├── tests/              # Unit and integration tests
├── docs/               # MkDocs documentation
└── examples/           # Example shader graphs
```

### Key Principles

1. **Core logic is framework-agnostic** - Business logic in `src/core/` doesn't depend on React
2. **Data-driven design** - Nodes and language packs are JSON-defined templates
3. **Type safety first** - Strict TypeScript with Zod validation
4. **Tests are mandatory** - All new features require tests

---

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Your Changes

- Keep changes focused and atomic
- Follow the existing code style
- Add tests for new functionality
- Update documentation if needed

### 3. Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature
git commit -m "feat: add color picker input component"

# Bug fix
git commit -m "fix: resolve shader compilation for nested nodes"

# Documentation
git commit -m "docs: update node creation guide"

# Breaking change
git commit -m "feat!: redesign node connection API"
```

**Commit Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Build process, dependencies

---

## Testing Your Changes

### Run All Tests

```bash
bun run test
```

### Run Tests with Coverage

```bash
bun run test:coverage
```

### Run Linter

```bash
bun run lint
```

### Run Type Check

```bash
bun x tsc --noEmit
```

### Required Quality Gates

Before submitting a PR, ensure:

- ✅ All tests pass (`bun run test`)
- ✅ Linting passes with 0 warnings (`bun run lint`)
- ✅ Type check passes (`bun x tsc --noEmit`)
- ✅ Code coverage doesn't decrease significantly

---

## Code Style Guidelines

### TypeScript

- Use TypeScript strict mode (already configured)
- Avoid `any` - use proper types or `unknown`
- Prefer `const` over `let`
- Use destructuring where appropriate
- Document public APIs with JSDoc

### React

- Use functional components with hooks
- Follow React Hooks rules (enforced by ESLint)
- Keep components focused and composable
- Extract complex logic into custom hooks or utilities

### File Naming

- React components: `PascalCase.tsx` (e.g., `GraphNode.tsx`)
- Utilities/helpers: `camelCase.ts` (e.g., `nodeFactory.ts`)
- Types: `types.ts` or `schema.ts`
- Tests: `*.spec.ts` or `*.test.ts`

### Example Code

```typescript
/**
 * Compiles a graph to a target language
 * @param graph - The graph to compile
 * @param languagePack - Target language pack
 * @returns Compiled shader code
 */
export function compileGraph(graph: Graph, languagePack: LanguagePack): string {
  // Implementation
}
```

---

## Submitting a Pull Request

### 1. Push Your Branch

```bash
git push origin feature/your-feature-name
```

### 2. Create Pull Request

1. Go to GitHub and create a new Pull Request
2. Fill out the PR template:
   - **Title**: Clear, descriptive title
   - **Description**: What does this PR do?
   - **Motivation**: Why is this change needed?
   - **Testing**: How was this tested?
   - **Screenshots**: If UI changes

### 3. PR Checklist

- [ ] Code follows project style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventional commits
- [ ] PR description is clear and complete
- [ ] No linter warnings
- [ ] No TypeScript errors

### 4. Code Review

- Be responsive to feedback
- Make requested changes promptly
- Keep discussions constructive
- Ask questions if something is unclear

### 5. After Merge

- Delete your branch
- Pull latest changes: `git pull upstream main`

---

## Adding New Nodes

### 1. Create Node Definition

Create a JSON file in `data/nodes/` (organize by category):

```json
{
  "id": -1,
  "type": "my_custom_node",
  "name": "My Custom Node",
  "meta": [],
  "position": [0, 0],
  "nodes": [],
  "inputs": [
    {
      "id": 0,
      "name": "input_a",
      "type": ["float", "float2", "float3"],
      "value": [0.0]
    }
  ],
  "outputs": [
    {
      "id": 0,
      "name": "result",
      "type": ["float", "float2", "float3"]
    }
  ],
  "properties": []
}
```

### 2. Add Templates to Language Packs

Update each language pack in `data/languages/`:

**Godot.json:**

```json
{
  "nodes": {
    "my_custom_node": {
      "template": "float {{name}} = custom_function({{inputs:0}});"
    }
  }
}
```

**ThreeJS_GLSL.json:**

```json
{
  "nodes": {
    "my_custom_node": {
      "template": "float {{name}} = custom_function({{inputs:0}});"
    }
  }
}
```

### 3. Test Your Node

1. Restart the dev server
2. Add your node in the graph editor
3. Connect it to other nodes
4. Compile and verify the output

### 4. Add Tests

Create a test in `tests/`:

```typescript
import { describe, test, expect } from "vitest";
import { compileGraph } from "@/core/compiler/graphCompiler";

describe("Custom Node", () => {
  test("compiles correctly", () => {
    const graph = {
      /* ... */
    };
    const code = compileGraph(graph, languagePack);
    expect(code).toContain("custom_function");
  });
});
```

---

## Adding Language Packs

### 1. Create Language Pack File

Create `data/languages/YourEngine.json`:

```json
{
  "name": "Your Engine",
  "version": "1.0",
  "file_extensions": ["shader"],
  "coordinates": {
    "up": "+y",
    "right": "+x",
    "forward": "+z",
    "handedness": "right"
  },
  "nodes": {
    "surface": {
      "template": [
        "// Your Engine Shader",
        "{{meta}}",
        "{{exposed_nodes}}",
        "{{internal_nodes}}"
      ]
    },
    "add": {
      "template": "float {{name}} = {{inputs:0}} + {{inputs:1}};"
    }
    // ... add templates for all nodes
  }
}
```

### 2. Test Language Pack

1. Restart the dev server
2. Switch to your language in the compile panel
3. Compile a graph and verify output
4. Test with various node types

### 3. Validation

Language packs are validated at runtime using Zod schemas. Check console for validation errors.

---

## Need Help?

- 📖 Read the [documentation](./docs)
- 💬 Open a [discussion](https://github.com/omid3098/openshadergraph/discussions)
- 🐛 Report [issues](https://github.com/omid3098/openshadergraph/issues)
- 📧 Contact maintainers (see README)

---

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

---

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to OpenShaderGraph! 🎨✨

