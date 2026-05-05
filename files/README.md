# IneNails — Inquiry Handler

A small Node.js server that takes booking submissions from the website, emails them to you, and sends an automatic confirmation to the customer (in English or Japanese, matching the language they used on the site).

---

## What it does

When a customer submits the booking form:

1. **Validates** the data (required fields, email format, future date, policy accepted)
2. **Filters bots** with a honeypot field + rate limiting (5 submissions per IP per 15 min)
3. **Emails you** the inquiry — with the customer's address set as the reply-to so you can just hit "Reply"
4. **Emails the customer** a polished confirmation in their language, including the policy reminder

---

## Setup (10 minutes)

### 1. Install
```bash
npm install
```

### 2. Configure email
Copy `.env.example` to `.env` and fill it in:
```bash
cp .env.example .env
```

**Easiest option — Gmail:**
1. Turn on 2-Step Verification on your Google account
2. Create an [App Password](https://myaccount.google.com/apppasswords) (16 characters)
3. Use those credentials in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-studio@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx
   FROM_EMAIL=your-studio@gmail.com
   OWNER_EMAIL=hello@inenails.com
   ```

**Better for production** — [Resend](https://resend.com), [Postmark](https://postmarkapp.com), or [SendGrid](https://sendgrid.com). Same fields, just swap `SMTP_HOST`/`PORT`/`USER`/`PASS` to their values. Better deliverability and you won't trip Gmail's send limits.

### 3. Run locally
```bash
npm run dev
```
You should see `✓ SMTP ready` and `✓ IneNails inquiry handler listening on :3000`.

Test it:
```bash
curl -X POST http://localhost:3000/api/inquiry \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"you@example.com","phone":"8081234567","service":"Free Nail Inspection","date":"2026-12-01","policyAccepted":true,"lang":"en"}'
```

### 4. Wire up the website
In `index.html`, replace the existing `<script>` block at the bottom (the one starting with `// ========== Form submit ==========`) with the contents of **`form-submit.js`**. Change the `API_ENDPOINT` constant to point at your deployed server.

### 5. Deploy
Any Node host works. Easiest free options:

- **Render** — push this folder to GitHub, connect the repo, set env vars, done
- **Railway** — `railway up`, set env vars in dashboard
- **Fly.io** — `fly launch`

After deploying, copy your live URL (e.g. `https://inenails-api.onrender.com`) into `API_ENDPOINT` in the frontend script.

---

## Files

| File | What it is |
|---|---|
| `server.js` | The inquiry handler (validation, email dispatch, rate limit) |
| `package.json` | Dependencies |
| `.env.example` | Config template — copy to `.env` and fill in |
| `form-submit.js` | Replacement frontend script that POSTs to the server |

---

## Customizing

- **Email templates** — edit `ownerEmail()` and `customerEmail()` in `server.js`. The customer template auto-switches between EN and JA based on what language the site was in when they submitted.
- **Rate limit** — change `max` and `windowMs` in `inquiryLimiter`
- **Add more fields** — add to the `validate()` function and to both email templates

---

## Don't want to run a server?

Then skip all this and use a hosted form service instead. Drop one of these into your form's `action` attribute and you're done:

- **[Web3Forms](https://web3forms.com)** — free, no signup required for basic use
- **[Formspree](https://formspree.io)** — generous free tier, easy upgrades
- **[EmailJS](https://www.emailjs.com)** — sends straight from the browser

Tradeoff: less control over validation, no custom auto-reply formatting, and you're depending on a third party. For a small studio, that's often a fine trade.
