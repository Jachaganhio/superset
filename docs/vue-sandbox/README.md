Superset Vue Sandbox

This folder is an isolated Vite + Vue sandbox used to test `test.vue` locally without affecting the main repository.

To run:

```bash
cd docs/vue-sandbox
npm install
npm run dev
# open http://localhost:5173
```

Notes:
- This sandbox aliases `@superset-ui/embedded-sdk` to a local mock so you don't need the real SDK to render the UI.
- All node_modules and lockfiles live inside `docs/vue-sandbox` when you run `npm install` here.
