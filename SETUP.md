# Setup — connecting profile / email capture to a backend

The Cost Model tab captures a visitor's profile (what they build, sector, geography) and an optional
email opt-in for a16z AI-policy updates. Because the site is static (GitHub Pages, no server),
submissions go to a hosted form endpoint you configure.

**Until you configure one, nothing leaves the browser** — submissions are written to `localStorage`
(key `leadSubmissions`) and logged, so the form is testable but collects nothing centrally.

## To turn it on

Set one constant near the top of `app.js`:

```js
var SUBMIT_ENDPOINT = "https://…";   // your form backend URL
```

The form POSTs JSON: `{ email, consent, roles[], sectors[], basedIn, availability, availState, ts, source }`.

### Options (pick one)

- **Formspree** (fastest) — create a form at formspree.io, use its endpoint
  `https://formspree.io/f/XXXXXXX`. Handles storage, spam filtering, and email notifications. Free
  tier covers low volume. Accepts the JSON POST as-is.
- **Google Apps Script → Sheet** — a `doPost(e)` web app that appends rows to a Google Sheet.
  Free, owned by you, exports easily. Deploy as "Anyone" and paste the `/exec` URL.
- **Airtable** — via a small proxy (Airtable's API needs a secret key, which can't ship in
  client-side code, so route through a Cloudflare Worker / Apps Script rather than calling Airtable
  directly from the browser).

### Consent & privacy

The email field has an explicit consent checkbox for a16z updates; `consent` is recorded in the
payload. If you collect emails, add a short privacy line and an unsubscribe path on the a16z side.
Don't hardcode any API secret in `app.js` — it's public. Endpoint URLs that only accept POSTs
(Formspree, Apps Script) are fine to commit; secret keys are not.
