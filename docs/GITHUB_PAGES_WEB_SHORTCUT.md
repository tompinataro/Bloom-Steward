# GitHub Pages Web Shortcut

This project can publish a browser version of Bloom Steward without changing the iOS App Store Connect or Android Play Store setup.

## Local Preview

```bash
npm run build:web:github
npx vite preview --host 0.0.0.0 --outDir build
```

The GitHub Pages build script uses:

```bash
EXPO_PUBLIC_API_URL=https://bloom-steward-2a872c497756.herokuapp.com
```

## Deploy

GitHub Pages is configured for this repo from `main` at `/docs`.

Build the shortcut into `docs/app`:

```bash
npm run build:web:github
```

After the built files are committed and pushed to `main`, the shortcut URL is:

```text
https://tompinataro.github.io/Bloom-Steward/app/
```

This is a web/PWA-style shortcut for immediate client access. It does not replace or modify the native App Store or Play Store builds.
