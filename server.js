// ============================================================
//  IneNails — Inquiry Handler
//  ----------------------------------------------------------
//  Receives booking form submissions and dispatches:
//    1) Owner notification email (to the studio inbox)
//    2) Customer auto-reply (bilingual EN/JA confirmation)
//
//  Run:  node server.js
//  Deploy: Render, Railway, Fly.io, Vercel, or any Node host
// ============================================================

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));

// CORS — restrict to your domain in production
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN?.split(',') || '*',
  methods: ['POST', 'GET'],
}));

// Rate limit: 5 inquiries per IP per 15 minutes
const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again shortly.' },
});

// ---------- Mail transporter ----------
// Works with Gmail (use an App Password — not your regular password),
// SendGrid, Postmark, Mailgun, AWS SES, or any SMTP provider.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((err) => {
  if (err) console.error('✗ SMTP connection failed:', err.message);
  else console.log('✓ SMTP ready');
});

// ---------- Validation helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[\d\s+()-]{7,20}$/;

const sanitize = (s) =>
  String(s || '')
    .replace(/[<>]/g, '')   // strip angle brackets
    .replace(/\r?\n/g, ' ') // flatten newlines in headers
    .trim()
    .slice(0, 500);

const sanitizeMultiline = (s) =>
  String(s || '').replace(/[<>]/g, '').trim().slice(0, 2000);

function validate(body) {
  const errors = [];
  const data = {
    firstName: sanitize(body.firstName),
    lastName: sanitize(body.lastName),
    email: sanitize(body.email).toLowerCase(),
    phone: sanitize(body.phone),
    service: sanitize(body.service),
    date: sanitize(body.date),
    notes: sanitizeMultiline(body.notes),
    policyAccepted: Boolean(body.policyAccepted),
    lang: ['en', 'ja'].includes(body.lang) ? body.lang : 'en',
  };

  if (!data.firstName) errors.push('First name is required');
  if (!data.lastName) errors.push('Last name is required');
  if (!EMAIL_RE.test(data.email)) errors.push('Valid email is required');
  if (!PHONE_RE.test(data.phone)) errors.push('Valid phone is required');
  if (!data.service) errors.push('Please select a service');
  if (!data.date) errors.push('Preferred date is required');
  if (!data.policyAccepted) errors.push('You must accept the booking policy');

  // Date must be today or future
  if (data.date) {
    const picked = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(picked) || picked < today) {
      errors.push('Preferred date must be today or later');
    }
  }

  return { data, errors };
}

// ---------- Email templates ----------
function ownerEmail(d) {
  const subject = `New booking inquiry — ${d.firstName} ${d.lastName} — ${d.service}`;
  const text = [
    'NEW BOOKING INQUIRY',
    '',
    `Name:     ${d.firstName} ${d.lastName}`,
    `Email:    ${d.email}`,
    `Phone:    ${d.phone}`,
    `Service:  ${d.service}`,
    `Date:     ${d.date}`,
    `Language: ${d.lang.toUpperCase()}`,
    '',
    'Notes:',
    d.notes || '(none)',
    '',
    'Policy accepted: yes',
    '',
    'Reply directly to this email to respond to the customer.',
  ].join('\n');

  const html = `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1A1816;background:#F5EFE8;padding:32px;border:1px solid #d8d0c4">
  <div style="border-bottom:1px solid #d8d0c4;padding-bottom:16px;margin-bottom:24px">
    <div style="font-size:11px;letter-spacing:0.3em;color:#B43F2E;text-transform:uppercase">New Inquiry · IneNails</div>
    <h1 style="font-size:24px;margin:8px 0 0;font-weight:500">${escapeHtml(d.firstName)} ${escapeHtml(d.lastName)}</h1>
  </div>
  <table style="width:100%;font-family:Georgia,serif;font-size:14px;line-height:1.7">
    <tr><td style="color:#4A4540;width:110px">Email</td><td><a href="mailto:${escapeHtml(d.email)}" style="color:#B43F2E">${escapeHtml(d.email)}</a></td></tr>
    <tr><td style="color:#4A4540">Phone</td><td><a href="tel:${escapeHtml(d.phone)}" style="color:#1A1816">${escapeHtml(d.phone)}</a></td></tr>
    <tr><td style="color:#4A4540">Service</td><td><strong>${escapeHtml(d.service)}</strong></td></tr>
    <tr><td style="color:#4A4540">Date</td><td>${escapeHtml(d.date)}</td></tr>
    <tr><td style="color:#4A4540">Language</td><td>${d.lang.toUpperCase()}</td></tr>
    <tr><td style="color:#4A4540">Policy</td><td>✓ Accepted</td></tr>
  </table>
  ${d.notes ? `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #d8d0c4">
      <div style="font-size:11px;letter-spacing:0.2em;color:#4A4540;text-transform:uppercase;margin-bottom:8px">Notes</div>
      <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(d.notes)}</div>
    </div>` : ''}
  <p style="margin-top:32px;font-size:12px;color:#4A4540">
    Reply directly to this message — it's set to reach ${escapeHtml(d.firstName)}.
  </p>
</div>`;

  return { subject, text, html };
}

function customerEmail(d) {
  const isJa = d.lang === 'ja';

  const subject = isJa
    ? 'IneNails — ご予約リクエストを受付しました'
    : 'IneNails — We received your appointment request';

  const greeting = isJa ? `${d.lastName} 様` : `Hi ${d.firstName},`;

  const intro = isJa
    ? 'IneNailsへのご予約リクエスト、誠にありがとうございます。下記の内容で承りました。営業時間内、4時間以内にご連絡いたします。'
    : 'Thank you for reaching out to IneNails. We\'ve received your request — a team member will confirm your appointment within 4 hours during business hours.';

  const summaryHeader = isJa ? 'ご予約内容' : 'Your request';
  const labels = isJa
    ? { service: 'サービス', date: 'ご希望日', phone: '電話番号', notes: 'ご要望' }
    : { service: 'Service', date: 'Preferred date', phone: 'Phone', notes: 'Notes' };

  const reminder = isJa
    ? '<strong>キャンセル規約のご確認:</strong> ご予約は返金不可ですが、振替が可能です。15分以上の遅刻は再予約となる場合があります。医療上の緊急事態は証明書のご提示で例外といたします。'
    : '<strong>A quick reminder of our policy:</strong> bookings are non-refundable but rescheduling is welcome. Arrivals more than 15 minutes late may need to reschedule. Documented medical emergencies are the only exception.';

  const closing = isJa ? 'お会いできる日を楽しみにしております。' : 'We\'re looking forward to seeing you.';
  const signoff = isJa ? '稲ネイルズ チーム' : 'The IneNails team';

  const text = [
    greeting,
    '',
    intro,
    '',
    `— ${summaryHeader} —`,
    `${labels.service}: ${d.service}`,
    `${labels.date}: ${d.date}`,
    `${labels.phone}: ${d.phone}`,
    d.notes ? `${labels.notes}: ${d.notes}` : '',
    '',
    reminder.replace(/<\/?strong>/g, ''),
    '',
    closing,
    signoff,
  ].filter(Boolean).join('\n');

  const html = `
<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1A1816;background:#F5EFE8;padding:40px 32px">
  <div style="font-size:11px;letter-spacing:0.3em;color:#B43F2E;text-transform:uppercase;margin-bottom:8px">◉ IneNails</div>
  <h1 style="font-size:28px;font-weight:500;margin:0 0 24px;letter-spacing:-0.01em">${escapeHtml(greeting)}</h1>
  <p style="font-size:15px;line-height:1.7;color:#4A4540;margin:0 0 32px">${escapeHtml(intro)}</p>

  <div style="background:#FBF7F1;border:1px solid #d8d0c4;padding:24px;margin-bottom:28px">
    <div style="font-size:11px;letter-spacing:0.2em;color:#B43F2E;text-transform:uppercase;margin-bottom:12px">${escapeHtml(summaryHeader)}</div>
    <table style="width:100%;font-size:14px;line-height:1.8">
      <tr><td style="color:#4A4540;width:130px">${labels.service}</td><td><strong>${escapeHtml(d.service)}</strong></td></tr>
      <tr><td style="color:#4A4540">${labels.date}</td><td>${escapeHtml(d.date)}</td></tr>
      <tr><td style="color:#4A4540">${labels.phone}</td><td>${escapeHtml(d.phone)}</td></tr>
      ${d.notes ? `<tr><td style="color:#4A4540;vertical-align:top">${labels.notes}</td><td style="white-space:pre-wrap">${escapeHtml(d.notes)}</td></tr>` : ''}
    </table>
  </div>

  <p style="font-size:13px;line-height:1.7;color:#4A4540;border-top:1px solid #d8d0c4;padding-top:20px;margin:0 0 28px">
    ${reminder}
  </p>

  <p style="font-size:15px;color:#1A1816;margin:0">${escapeHtml(closing)}</p>
  <p style="font-size:14px;color:#4A4540;margin:8px 0 0;font-style:italic">— ${escapeHtml(signoff)}</p>

  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #d8d0c4;font-size:11px;color:#8a857d;letter-spacing:0.04em">
    IneNails · Honolulu, HI · hello@inenails.com<br/>
    ${isJa ? '火〜日 · 10:00–19:00 · 完全予約制' : 'Tue–Sun · 10:00–19:00 · By appointment'}
  </div>
</div>`;

  return { subject, text, html };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Routes ----------
app.get('/health', (req, res) => res.json({ ok: true, service: 'inenails-inquiry' }));

app.post('/api/inquiry', inquiryLimiter, async (req, res) => {
  try {
    // Honeypot — real users leave this empty; bots fill it
    if (req.body.website || req.body._gotcha) {
      // Pretend success so bots don't retry
      return res.json({ ok: true });
    }

    const { data, errors } = validate(req.body);
    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const owner = ownerEmail(data);
    const customer = customerEmail(data);

    // Send owner notification — replyTo points at the customer
    await transporter.sendMail({
      from: `"IneNails Bookings" <${process.env.FROM_EMAIL}>`,
      to: process.env.OWNER_EMAIL,
      replyTo: `"${data.firstName} ${data.lastName}" <${data.email}>`,
      subject: owner.subject,
      text: owner.text,
      html: owner.html,
    });

    // Send customer auto-reply
    await transporter.sendMail({
      from: `"IneNails" <${process.env.FROM_EMAIL}>`,
      to: data.email,
      replyTo: process.env.OWNER_EMAIL,
      subject: customer.subject,
      text: customer.text,
      html: customer.html,
    });

    console.log(`[inquiry] ${data.email} · ${data.service} · ${data.date}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[inquiry] error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Something went wrong on our end. Please call (808) 000-0000 or try again.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`✓ IneNails inquiry handler listening on :${PORT}`);
});
