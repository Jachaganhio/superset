# LLM Context Guide for Apache Superset

Apache Superset is a data visualization platform with Flask/Python backend and React/TypeScript frontend.

## ⚠️ CRITICAL: Ongoing Refactors (What NOT to Do)

**These migrations are actively happening - avoid deprecated patterns:**

### Frontend Modernization
- **NO `any` types** - Use proper TypeScript types
- **NO JavaScript files** - Convert to TypeScript (.ts/.tsx)
- **Use @superset-ui/core** - Don't import Ant Design directly, prefer Ant Design component wrappers from @superset-ui/core/components
- **Use antd theming tokens** - Prefer antd tokens over legacy theming tokens
- **Avoid custom css and styles** - Follow antd best practices and avoid styling and custom CSS whenever possible

### Testing Strategy Migration
- **Prefer unit tests** over integration tests
- **Prefer integration tests** over Cypress end-to-end tests
- **Cypress is last resort** - Actively moving away from Cypress
- **Use Jest + React Testing Library** for component testing

### Backend Type Safety
- **Add type hints** - All new Python code needs proper typing
- **MyPy compliance** - Run `pre-commit run mypy` to validate
- **SQLAlchemy typing** - Use proper model annotations

### UUID Migration
- **Prefer UUIDs over auto-incrementing IDs** - New models should use UUID primary keys
- **External API exposure** - Use UUIDs in public APIs instead of internal integer IDs
- **Existing models** - Add UUID fields alongside integer IDs for gradual migration

## Key Directories

```
superset/
├── superset/                    # Python backend (Flask, SQLAlchemy)
│   ├── views/api/              # REST API endpoints
│   ├── models/                 # Database models
│   └── connectors/             # Database connections
├── superset-frontend/src/       # React TypeScript frontend
│   ├── components/             # Reusable components
│   ├── explore/                # Chart builder
│   ├── dashboard/              # Dashboard interface
│   └── SqlLab/                 # SQL editor
├── superset-frontend/packages/
│   └── superset-ui-core/       # UI component library (USE THIS)
├── tests/                      # Python/integration tests
├── docs/                       # Documentation (UPDATE FOR CHANGES)
└── UPDATING.md                 # Breaking changes log
```

## Code Standards

### TypeScript Frontend
- **Avoid `any` types** - Use proper TypeScript, reuse existing types
- **Functional components** with hooks
- **@superset-ui/core** for UI components (not direct antd)
- **Jest** for testing (NO Enzyme)
- **Redux** for global state where it exists, hooks for local

### Python Backend  
- **Type hints required** for all new code
- **MyPy compliant** - run `pre-commit run mypy`
- **SQLAlchemy models** with proper typing
- **pytest** for testing

### Apache License Headers
- **New files require ASF license headers** - When creating new code files, include the standard Apache Software Foundation license header
- **LLM instruction file is excluded** - `AGENT.md` is in `.rat-excludes` to avoid header token overhead

### Code Comments
- **Avoid time-specific language** - Don't use words like "now", "currently", "today" in code comments as they become outdated
- **Write timeless comments** - Comments should remain accurate regardless of when they're read

## Documentation Requirements

- **docs/**: Update for any user-facing changes
- **UPDATING.md**: Add breaking changes here
- **Docstrings**: Required for new functions/classes

## Architecture Patterns

### Security & Features
- **RBAC**: Role-based access via Flask-AppBuilder
- **Feature flags**: Control feature rollouts
- **Row-level security**: SQL-based data access control

## Test Utilities

### Python Test Helpers
- **`SupersetTestCase`** - Base class in `tests/integration_tests/base_tests.py`
- **`@with_config`** - Config mocking decorator
- **`@with_feature_flags`** - Feature flag testing
- **`login_as()`, `login_as_admin()`** - Authentication helpers
- **`create_dashboard()`, `create_slice()`** - Data setup utilities

### TypeScript Test Helpers
- **`superset-frontend/spec/helpers/testing-library.tsx`** - Custom render() with providers
- **`createWrapper()`** - Redux/Router/Theme wrapper
- **`selectOption()`** - Select component helper
- **React Testing Library** - NO Enzyme (removed)

### Test Database Patterns
- **Mock patterns**: Use `MagicMock()` for config objects, avoid `AsyncMock` for synchronous code
- **API tests**: Update expected columns when adding new model fields

### Running Tests
```bash
# Frontend
npm run test                           # All tests
npm run test -- filename.test.tsx     # Single file

# Backend  
pytest                                 # All tests
pytest tests/unit_tests/specific_test.py  # Single file
pytest tests/unit_tests/               # Directory

# If pytest fails with database/setup issues, ask the user to run test environment setup
```

## Environment Validation

**Quick Setup Check (run this first):**

```bash
# Verify Superset is running
curl -f http://localhost:8088/health || echo "❌ Setup required - see https://superset.apache.org/docs/contributing/development#working-with-llms"
```

**If health checks fail:**
"It appears you aren't set up properly. Please refer to the [Working with LLMs](https://superset.apache.org/docs/contributing/development#working-with-llms) section in the development docs for setup instructions."

**Key Project Files:**
- `superset-frontend/package.json` - Frontend build scripts (`npm run dev` on port 9000, `npm run test`, `npm run lint`)
- `pyproject.toml` - Python tooling (ruff, mypy configs)
- `requirements/` folder - Python dependencies (base.txt, development.txt)

## SQLAlchemy Query Best Practices  
- **Use negation operator**: `~Model.field` instead of `== False` to avoid ruff E712 errors
- **Example**: `~Model.is_active` instead of `Model.is_active == False`

## Pre-commit Validation

**Use pre-commit hooks for quality validation:**

```bash
# Install hooks
pre-commit install

# IMPORTANT: Stage your changes first!
git add .                        # Pre-commit only checks staged files

# Quick validation (faster than --all-files)
pre-commit run                   # Staged files only
pre-commit run mypy              # Python type checking
pre-commit run prettier          # Code formatting
pre-commit run eslint            # Frontend linting
```

**Important pre-commit usage notes:**
- **Stage files first**: Run `git add .` before `pre-commit run` to check only changed files (much faster)
- **Virtual environment**: Activate your Python virtual environment before running pre-commit
  ```bash
  # Common virtual environment locations (yours may differ):
  source .venv/bin/activate      # if using .venv
  source venv/bin/activate       # if using venv
  source ~/venvs/superset/bin/activate  # if using a central location
  ```
  If you get a "command not found" error, ask the user which virtual environment to activate
- **Auto-fixes**: Some hooks auto-fix issues (e.g., trailing whitespace). Re-run after fixes are applied

## Common File Patterns

### API Structure
- **`/api.py`** - REST endpoints with decorators and OpenAPI docstrings
- **`/schemas.py`** - Marshmallow validation schemas for OpenAPI spec
- **`/commands/`** - Business logic classes with @transaction() decorators
- **`/models/`** - SQLAlchemy database models
- **OpenAPI docs**: Auto-generated at `/swagger/v1` from docstrings and schemas

### Migration Files
- **Location**: `superset/migrations/versions/`
- **Naming**: `YYYY-MM-DD_HH-MM_hash_description.py`
- **Utilities**: Use helpers from `superset.migrations.shared.utils` for database compatibility
- **Pattern**: Import utilities instead of raw SQLAlchemy operations

## Agent Entry Point

- **Single source of truth**: `AGENT.md` is the only LLM guidance file for this repository.
- **Supported tools**: OpenCode and GitHub Copilot.
- **Policy**: Do not add parallel guidance files (`CLAUDE.md`, `GEMINI.md`, `GPT.md`, `AGENTS.md`, or Cursor-specific rule mirrors).

---

**LLM Note**: This codebase is actively modernizing toward full TypeScript and type safety. Always run `pre-commit run` to validate changes. Follow the ongoing refactors section to avoid deprecated patterns.

## Domain Appendix: MCP Service

These rules apply when working in `superset/mcp_service/`.

- **Registration pattern**: MCP tools, prompts, and resources register via decorators on import; ensure they are imported from `superset/mcp_service/app.py`.
- **Tool decorators**: Use `@mcp.tool` (without empty parentheses) and `@mcp_auth_hook` for every tool.
- **Prompt/resource decorators**: Use `@mcp.prompt("name")` and `@mcp.resource("superset://...")`, and ensure module-level imports expose them.
- **Schema and data access**: Use Pydantic schemas for request/response models and use Superset DAO classes instead of direct DB queries.
- **Typing style**: Use Python 3.10+ unions (`T | None`) instead of `Optional[T]`.
- **License header enforcement**: Every Python file in MCP service must include the ASF header.

### MCP Checklist

- Add or update schema in `superset/mcp_service/*/schemas.py`
- Add implementation under `superset/mcp_service/*/tool/`, `*/prompts/`, or `*/resources/`
- Export via corresponding `__init__.py` when needed
- Import module in `superset/mcp_service/app.py` to trigger registration
- Add or update unit tests in `tests/unit_tests/mcp_service/`

## Task Appendix: JavaScript to TypeScript Migration

These rules apply to JS/JSX -> TS/TSX migrations in `superset-frontend/`.

- **Atomic unit**: Migrate the core file and all related tests/mocks together.
- **Preserve history**: Use `git mv` for file renames.
- **No global churn**: Avoid unrelated global import rewrites.
- **No `any`**: Reuse existing Superset types where possible.
- **Validation strategy**: Validate migrated files individually with TypeScript and check downstream importers individually.
- **Linting**: Run ESLint with autofix on changed frontend files.

### JS->TS Checklist

- Identify related files (`*.test.js[x]`, `*.spec.js[x]`, `__mocks__/*`)
- Rename files with `git mv`
- Apply explicit types (no `any`)
- Validate each changed file and key downstream importers
- Run ESLint on changed files
