# SendGrid Email Templates For Lineage Tree

This project does not currently include a backend email sender, so the cleanest approach is:

1. Keep the mobile app focused on user actions.
2. Trigger email work from a backend function or trusted server.
3. Use SendGrid to render and deliver branded transactional emails.

## Recommended email set

### 1. Family tree invite

Use when an owner or editor adds a collaborator to a tree.

Best fit in this codebase:
- `providers/family-tree-service.ts`
- The current collaborator flow is driven from `addCollaborator(...)`.

Recommended data:
- `recipientEmail`
- `recipientName`
- `inviterName`
- `treeName`
- `roleLabel`
- `inviteUrl`
- `message`
- `expiresIn`

Why it matters:
- This is the highest-value email in the product because it turns tree-sharing into an actual user acquisition flow.

### 2. Password reset

Use when a user taps "Forgot password?" from login.

Best fit in this codebase:
- `app/screens/auth/login/login-view.tsx`
- `stores/auth-store.ts`

Recommended data:
- `recipientName`
- `resetUrl`
- `expiresIn`

Implementation note:
- Firebase Auth already supports password reset links.
- You can either use Firebase’s built-in reset email or generate the reset link server-side and send it with your branded SendGrid template.

### 3. Account created / welcome email

Use after signup or after an admin-style user creation flow.

Best fit in this codebase:
- `stores/auth-store.ts`
- Specifically after `signUp(...)` succeeds.

Recommended data:
- `recipientName`
- `loginUrl`
- `temporaryPassword`
- `createdByName`

Why it matters:
- It reassures the user that account creation worked and gives them a clear next step.

### 4. Product notifications

Use for important actions only, not every in-app event.

Best fit in this codebase:
- `components/dto/notification.ts`
- `providers/family-tree-service.ts`
- `stores/tree-store.ts`

High-value notification ideas:
- Approval requested for profile or relationship changes
- Approval decision made
- Merge invite received
- Merge completed
- Collaborator role changed
- User linked to a family member profile

Recommended data:
- `recipientName`
- `title`
- `summary`
- `actionUrl`
- `actionLabel`
- `metadata`

## Template design direction

The template module in [constants/email-templates.ts](C:/Users/Admin/WebstormProjects/lineagetree/constants/email-templates.ts) uses a visual direction that suits Lineage Tree:

- Deep heritage green for trust and product identity
- Warm parchment background for a family-history feel
- Serif headlines for warmth and legacy
- Clean sans-serif body copy for readability
- Rounded CTA buttons and soft cards so the emails still feel modern

This gives the brand a more personal and memorable feel than generic SaaS notification emails.

## Suggested implementation architecture

### Option A: Firebase Cloud Functions plus SendGrid

Recommended if you want the simplest fit with the current stack.

Flow:
1. App writes the business event to Firestore or calls a callable function.
2. Cloud Function validates permissions and loads template data.
3. Function calls SendGrid with subject, HTML, and plain text.
4. Function stores an email audit record if needed.

Good triggers for this app:
- `onDocumentCreated` for invite records
- `onDocumentCreated` for approval requests
- direct callable function for account-created emails
- direct callable function for resend-invite emails

### Option B: Dedicated backend service

Recommended if you expect richer email workflows later.

Flow:
1. App or Firebase emits an event.
2. Backend receives the event.
3. Backend chooses a SendGrid template and sends the email.
4. Backend tracks retries, delivery state, and suppression rules.

This is better if you expect:
- digests
- retries
- unsubscribe preferences for non-critical mail
- admin reporting
- multi-channel notifications later

## Where emails should be used in Lineage Tree

### Strong candidates

- Collaborator invite after tree access is granted
- Password reset from login
- Welcome email after successful signup
- Approval request when edits need review
- Merge invitation when one tree invites another

### Optional later additions

- Weekly family activity summary
- Reminder that an approval window will expire soon
- Reminder that an invite has not been accepted
- Notification that a collaborator was removed or downgraded
- Celebration email when a new branch or milestone is added

## Implementation phases

### Phase 1: Immediate transactional coverage

Build first:
- Invite email
- Password reset email
- Account created email
- Generic notification email

Outcome:
- You cover the main user lifecycle and the most important tree collaboration moments.

### Phase 2: Trigger wiring

Build next:
- backend sender
- event payload contracts
- retry logging
- email audit collection

Outcome:
- Emails become operational and supportable.

### Phase 3: Product polish

Build later:
- per-template analytics
- resend invite flow
- scheduled reminders
- notification preference controls
- localization for your existing i18n language setup

## Suggested SendGrid data contract

Keep the payload stable across templates:

```ts
type TransactionalEmailPayload = {
  to: string;
  templateKey: 'invite' | 'passwordReset' | 'accountCreated' | 'notification';
  dynamicTemplateData: Record<string, unknown>;
};
```

For this repo, I would keep the app-side code responsible only for creating business events, and keep all email rendering and delivery in backend code. That avoids exposing SendGrid credentials and keeps your notification rules centralized.

## Notes on the provided template module

The reusable template code lives in:

- [constants/email-templates.ts](C:/Users/Admin/WebstormProjects/lineagetree/constants/email-templates.ts)

It gives you:

- a consistent shared layout
- branded HTML and plain-text output
- dedicated builders for invite, password reset, account creation, and generic notifications
- typed input contracts so backend integration is less error-prone

## Nice next-step ideas

### Make invite emails feel more personal

Allow the inviter to include a short note like:

"We’re adding the Mthembu side of the family this week and would love your help with names and dates."

### Add smart notification grouping

Instead of sending one email per small action, batch related events into:

- "3 updates need your review"
- "2 family members were updated"

### Add tree-specific deep links

Use links that open directly into:

- a specific tree
- a pending approval
- a merge request
- the collaborator setup flow

### Add localization later

Your app already has an `i18n` structure, so these emails can later be localized per user language once the backend knows the recipient locale.
