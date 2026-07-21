# Backend Email Setup

This repo is now wired for Firebase Functions as the backend email sender.

## What was mapped

- Welcome email:
  - App calls `sendWelcomeEmail` after signup succeeds.
- Tree invite email:
  - App calls `sendTreeInviteEmail` after a collaborator is added.
- Password reset email:
  - Backend callable `sendPasswordResetEmail` is ready.
  - The store now exposes `requestPasswordReset(email)`, but the login UI still needs a "Forgot password?" action to call it.
- Notification email:
  - Backend trigger `sendNotificationEmailOnCreate` sends an email when a pending `merge-invite` notification document is created.

## What you need to do on your end

### 1. Install backend dependencies

Run this from the repo root:

```powershell
npm install --prefix functions
```

### 2. Set Firebase Functions secrets and params

Set the SendGrid API key as a Firebase secret:

```powershell
firebase functions:secrets:set SENDGRID_API_KEY
```

Then create a Functions env file. The Firebase Functions docs explain that `defineString(...)` parameters are loaded from local `functions/.env*` files or prompted for during deployment:

- [Configure your environment](https://firebase.google.com/docs/functions/config-env)

Create `functions/.env` for local development or `functions/.env.<your-firebase-project-id>` for deploy-time values:

```env
SENDGRID_FROM_EMAIL=no-reply@yourdomain.com
SENDGRID_FROM_NAME=Lineage Tree
APP_BASE_URL=https://lineagetree.web.app
SUPPORT_EMAIL=support@yourdomain.com
```

### 3. Verify SendGrid sender identity

In SendGrid, make sure you have verified:

- the sending domain, or
- the single sender address used in `SENDGRID_FROM_EMAIL`

Without that, SendGrid will reject the messages.

### 4. Deploy the backend functions

```powershell
npm run deploy:functions
```

### 5. Add app env values

In your app `.env`, set:

```env
EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION=us-central1
EXPO_PUBLIC_APP_BASE_URL=https://lineagetree.web.app
```

The code already defaults to `us-central1`, but it is better to set it explicitly.

### 6. Restart the Expo app

After updating `.env`, restart the app so the Functions region is picked up.

## Suggested first test flow

### Welcome email

1. Create a brand-new account in the app.
2. Confirm the account is created.
3. Check that the new user receives the welcome email.

### Tree invite email

1. Sign in as an existing user.
2. Add a collaborator who already has an account.
3. Confirm the collaborator gets the invite email.

### Merge notification email

1. Send a merge invite from one account to another.
2. Confirm the in-app notification document appears.
3. Confirm the target user receives the notification email.

### Password reset email

1. Wire the login screen to call `requestPasswordReset(email)`.
2. Trigger it with a known account.
3. Confirm the reset email arrives and the link works.

## Important notes

- Welcome and collaborator emails are best-effort right now.
  - The app action still succeeds even if email delivery fails.
  - This avoids blocking signup or collaborator management when SendGrid has a transient issue.
- The password reset callable intentionally does not reveal whether an email exists.
  - That is safer for account enumeration.
- Only `merge-invite` notifications are mapped to email today.
  - Approval-request emails can be added next once you decide which approval events should generate mail.

## Recommended next step

Add a "Forgot password?" button in the login flow and connect it to `useAuthStore().requestPasswordReset(email)`. That will complete the first secure auth-email loop end to end.
