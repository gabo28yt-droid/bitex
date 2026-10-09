# BiteX

BiteX connects food donors, beneficiaries, and delivery volunteers to coordinate food donations.

## Requirements

- Node.js 20.19 or later
- npm

## Run locally

```sh
npm ci
npm run dev
```

Vite prints the local URL when the development server starts.

## Validate and build

```sh
npm run lint
npm run build
npm run preview
```

The production site is generated in `dist/`.

## Deploy to Firebase Hosting

The Firebase project is selected in `.firebaserc`. Build first, then deploy Hosting with the Firebase CLI:

```sh
npm run build
firebase deploy --only hosting
```

Firebase Hosting is configured to serve `dist/` and rewrite app routes to `index.html` for React Router.
