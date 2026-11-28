# React + Vite

## Firestore recovery

The original recovery export is stored at `recovery/recoverdata.json`, outside
the web server's public directory. Its contents are unchanged. The app's
Firestore target is `dmcdemo-ccfba`; the restore script checks that project ID
before writing. To restore missing records, run:

```sh
npm run restore:recovery -- --dry-run
npm run restore:recovery
```

The export contains 195 original documents. The restore keeps their IDs and
data, skips records already in Firestore, and verifies the expected document
IDs afterward. It also creates 18 project records and 5 supporting list
records so the recovered data appears in the app. Of those projects, 17 names
come from expense references; one is clearly labeled because its original name
was unavailable. Refresh the app from the header to load the current Firestore
data.

The recovery file does not contain the original project collection. A cached
Firestore query reports 64 projects, but includes no project IDs or document
fields for that collection. Those missing projects require another backup or
an export from a browser profile that still has their document data.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
