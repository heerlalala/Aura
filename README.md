# Aura

Aura is a static HTML, CSS, and vanilla JavaScript application. Firebase Authentication provides email/password and Google sign-in. Transcript handling, heuristic analysis, advice, and practice simulations run in the browser; Aura has no configured AI-analysis backend or transcript database.

## Run locally

Serve the repository over HTTP so the Firebase ES modules can load. From the repository root in PowerShell:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/`. Stop the server with `Ctrl+C`.

The Firebase web app configuration is in `js/firebase-config.js`. Set up the existing project’s Web app and enable the authentication providers you intend to use. Add `localhost` and the deployed site’s host to Firebase Authentication’s authorized domains. Do not put service-account credentials or provider secrets in this static repository. The Firebase web API key is public client configuration and should remain restricted in Google Cloud.

## Conversation workflow

1. Sign in with Firebase, then open **Chat Upload Center**.
2. Paste a transcript or choose a `.txt` or `.json` file. Files are read in the browser, limited to 1 MiB and 5,000 messages. Supported text lines are `Speaker: message`, timestamped `[timestamp] Speaker: message`, and common WhatsApp export lines. JSON is an array or an object with a `messages` array; each item needs a `speaker` or `sender` and `text` or `message` field. Timestamps are optional.
3. Review and edit the preview, then select **Run Analysis**. Unassigned lines are reported and omitted. PDF files, images, and OCR are not supported.
4. Aura stores each saved conversation under `aura_state_vault:<Firebase UID>` in this browser’s `localStorage`. Choose saved conversations from the picker; a new upload creates a new draft, and deleting a conversation requires confirmation.
5. Analysis results cite message IDs from that conversation version. Findings and advice are deterministic wording/topic heuristics, not AI output, diagnoses, reliable safety assessments, or predictions of anyone’s intent or behavior. Simulator replies are fictional exercises based on the selected transcript’s last message, detected text cues, and chosen practice objective.
6. **Print / Save Report as PDF** opens the browser’s native print dialog. Choose **Save as PDF** there. Aura cannot detect whether the dialog’s file-save step succeeded.

## Privacy and security limits

- Firebase handles authentication. Aura does not copy passwords or ID tokens into its app state. Authentication session persistence is managed by the Firebase SDK.
- Conversation text, message references, journals, and practice drafts are kept in browser-local state scoped by the signed-in Firebase UID. This is not encrypted by Aura, does not sync between devices, and can be read by someone with access to the browser profile. Browser storage quotas and user settings may prevent persistence.
- Transcript files are not uploaded to a third party. No AI provider or analysis API endpoint is configured.
- Aura does not record, accept, upload, or store audio. Therefore audio encryption is not implemented and must not be claimed.
- Aura shows MFA status reported by Firebase but does not enroll or remove factors. Firebase web MFA requires Authentication with Identity Platform and verified email; the project’s current plan and MFA console settings have not been verified. See [Firebase web MFA prerequisites](https://firebase.google.com/docs/auth/web/multi-factor).
- No Firestore or Firebase Storage integration is configured in this application.

## Checks

Run focused conversation-service tests:

```powershell
node --test tests/conversation-service.test.js
```

Check JavaScript syntax and whitespace:

```powershell
Get-ChildItem js -Filter '*.js' | ForEach-Object { node --check $_.FullName }
node --check tests/conversation-service.test.js
git diff --check
```
