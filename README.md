# 🐾 PawLex — AI Platform for Pet Businesses

> The OpenVLaw for the $150B pet services industry.

PawLex is an AI-powered compliance, contracts & operations platform built for groomers, vets, trainers, boarders, and shelters.

## 🌐 Live Site
[meetpawlex.com](https://meetpawlex.com)

## 📁 File Structure

```
meetpawlex/
├── index.html       ← Main landing page
├── privacy.html     ← Privacy policy
├── style.css        ← All styles
├── script.js        ← JavaScript (nav, form, animations)
├── favicon.svg      ← Browser tab icon
└── README.md        ← This file
```

## 🚀 Deploy to GitHub Pages

1. Create a GitHub repo named `meetpawlex`
2. Upload all files to the `main` branch
3. Go to **Settings → Pages**
4. Set source to `main` branch, `/ (root)`
5. Your site goes live at `https://yourusername.github.io/meetpawlex`

## 🌍 Connect Custom Domain (meetpawlex.com)

### Step 1 — Add CNAME file to your repo
Create a file named `CNAME` (no extension) containing:
```
meetpawlex.com
```

### Step 2 — Update DNS at your registrar (Cloudflare/Namecheap)
Add these DNS records:

| Type  | Name | Value                   |
|-------|------|-------------------------|
| A     | @    | 185.199.108.153         |
| A     | @    | 185.199.109.153         |
| A     | @    | 185.199.110.153         |
| A     | @    | 185.199.111.153         |
| CNAME | www  | yourusername.github.io  |

### Step 3 — Enable HTTPS
In GitHub Pages settings, check **"Enforce HTTPS"** after DNS propagates (10–30 mins).

## 📧 Enable Real Email Collection

The waitlist form is ready. To collect real emails, connect one of these:

### Option A — Formspree (easiest, free)
1. Sign up at [formspree.io](https://formspree.io)
2. Create a new form, get your form ID
3. In `script.js`, uncomment the `sendToFormspree` function
4. Replace `YOUR_FORM_ID` with your actual ID

### Option B — EmailJS (sends to your email instantly)
1. Sign up at [emailjs.com](https://emailjs.com)
2. Create a service and email template
3. Uncomment the `sendEmail` function in `script.js`
4. Replace the placeholder IDs

### Option C — Mailchimp Embed
Replace the form action with your Mailchimp embed URL.

## 🎨 Customize

- **Colors** — edit CSS variables at the top of `style.css`
- **Content** — edit text directly in `index.html`
- **Pricing** — update the pricing section in `index.html`
- **Logo** — replace `favicon.svg` with your own

## 📬 Contact
hello@meetpawlex.com

---
Built with 🐾 in Miami, FL.
