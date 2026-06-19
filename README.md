# Lineage Tree

A React Native + Expo family tree app backed by Firebase Authentication, Firestore, and Storage.

## Implemented features

- Multiple family trees per signed-in user
- Main tabbed workspace for tree, members, settings, and profile
- Create, rename, delete, and list trees
- Shared-tree access with owner, editor, and viewer roles
- Owner-managed collaborator add/remove support by email
- Owner-only tree deletion enforced in Firestore rules
- Self-to-person assignment for collaborators
- Approval requests for person and relationship changes when review is needed
- Person create, edit, delete with:
  - first name
  - last name
  - date-picker birth date input
  - gender
  - notes
  - photos from library or camera capture
  - life events and preferred photo selection
- Relationship management with:
  - parent -> child links
  - spouse <-> spouse links
  - duplicate prevention
  - relationship removal
- Live UI updates through Firestore subscriptions

## Required Firebase environment variables

Set these in your Expo environment before starting the app:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

## Run locally

```powershell
npm install
npm start
```

## Run the web app locally

```powershell
npm run web
```

## Export the web build

This project uses Expo web export and outputs the static site to `dist/`.

```powershell
npm run export:web
```

## Deploy the web app to Firebase Hosting

This repo is configured for Firebase Hosting with the default Firebase project set to `lineagetree` in `.firebaserc`.

Note: Expo web export emits some runtime assets, including icon fonts, under `dist/assets/node_modules/`. Firebase Hosting must not ignore that path during deploys or the deployed site will serve `index.html` instead of the font files.

First-time setup:

```powershell
npm install
npx firebase-tools login
```

Then deploy:

```powershell
npm run deploy:web
```

That command will:

1. export the Expo web app into `dist/`
2. deploy only Firebase Hosting

## Shared tree permissions

- **Owner**: can rename/delete the tree, manage collaborators, and edit people/relationships
- **Editor**: can edit people and relationships, including approval-driven changes
- **Viewer**: can read the tree but cannot make changes

## Notes

- Tree deletion removes linked people, relationships, photos, and approval requests together.
- Some legacy screen files remain in the repo for reference, but the active app entry point is the `Main` stack flow.

## Type-check

```powershell
npx tsc --noEmit
```

## Firebase rules to deploy

```powershell
npm run deploy:firebase
```
