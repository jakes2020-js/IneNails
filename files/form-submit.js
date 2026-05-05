// ============================================================
//  IneNails — Frontend form submission
//  ----------------------------------------------------------
//  Replace the existing form-submit block in index.html
//  (the section starting with `const form = document.getElementById('bookForm');`)
//  with this code.
// ============================================================

// CHANGE THIS to your deployed API URL
const API_ENDPOINT = 'https://your-server.onrender.com/api/inquiry';
// For local testing: 'http://localhost:3000/api/inquiry'

const form = document.getElementById('bookForm');
const success = document.getElementById('formSuccess');
const submitBtn = form.querySelector('.form-submit');
const submitLabel = submitBtn.querySelector('span');
const originalLabel = submitLabel.textContent;

// Add a honeypot field (invisible — bots fill it, humans don't)
const honeypot = document.createElement('input');
honeypot.type = 'text';
honeypot.name = 'website';
honeypot.tabIndex = -1;
honeypot.autocomplete = 'off';
honeypot.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
honeypot.setAttribute('aria-hidden', 'true');
form.appendChild(honeypot);

// Inline error display
let errorBox = document.createElement('div');
errorBox.style.cssText = 'display:none;background:#fde8e4;border:1px solid #B43F2E;color:#8E2E20;padding:14px 18px;border-radius:4px;margin-bottom:20px;font-size:13px;line-height:1.5';
form.insertBefore(errorBox, form.firstChild);

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function clearError() {
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Collect form data
  const fd = new FormData(form);
  const payload = {
    firstName: fd.get('firstName'),
    lastName: fd.get('lastName'),
    email: fd.get('email'),
    phone: fd.get('phone'),
    service: fd.get('service'),
    date: fd.get('date'),
    notes: fd.get('notes'),
    website: fd.get('website') || '', // honeypot
    policyAccepted: form.querySelector('input[type="checkbox"]').checked,
    lang: document.documentElement.lang === 'ja' ? 'ja' : 'en',
  };

  // UI: loading state
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.6';
  submitBtn.style.cursor = 'wait';
  submitLabel.textContent = payload.lang === 'ja' ? '送信中…' : 'Sending…';

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      const msg = (data.errors && data.errors.join(' · ')) ||
                  data.error ||
                  (payload.lang === 'ja'
                    ? '送信に失敗しました。お電話でもご予約いただけます。'
                    : 'We couldn\'t send your request. Please try again or call us directly.');
      showError(msg);
      submitBtn.disabled = false;
      submitBtn.style.opacity = '';
      submitBtn.style.cursor = '';
      submitLabel.textContent = originalLabel;
      return;
    }

    // Success — show confirmation panel
    form.style.display = 'none';
    success.classList.add('show');
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.error(err);
    showError(payload.lang === 'ja'
      ? 'ネットワークエラーが発生しました。お電話でのご予約も承っております。'
      : 'Network error — please try again or call us directly.');
    submitBtn.disabled = false;
    submitBtn.style.opacity = '';
    submitBtn.style.cursor = '';
    submitLabel.textContent = originalLabel;
  }
});

// Set min date to today (preserved from the original)
const dateInput = form.querySelector('input[name="date"]');
const today = new Date().toISOString().split('T')[0];
dateInput.setAttribute('min', today);
