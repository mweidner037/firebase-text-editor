# Firebase text-editor

Collaborative plain text editor using CRDTs on top of Firebase (Realtime Database).

## Installation

First, install [Node.js](https://nodejs.org/). Then run `npm i`.

## Commands

### `npm run dev`

Build the server from `src/`, with browser-facing content in [development mode](https://webpack.js.org/guides/development/).

You must pass the `FirebaseOptions` object (for `initializeApp`) in the `FIREBASE_CONFIG` env var, as a JSON string.

### `npm run build`

Build the server from `src/`, with browser-facing content in [production mode](https://webpack.js.org/guides/production/) (smaller output files; longer build time; no source maps).

You must pass the `FirebaseOptions` object (for `initializeApp`) in the `FIREBASE_CONFIG` env var, as a JSON string.

### `npm start`

Run the server. Open [http://localhost:3000/](http://localhost:3000/) to view. Use multiple browser windows at once to test collaboration.

The port can be configured with the PORT environment variable. It defaults to 3000.

### `npm run clean`

Delete `build/`.
