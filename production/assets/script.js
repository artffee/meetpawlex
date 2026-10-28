/* PawLex — meetpawlex.com
   Vanilla JS: command tabs, waitlist form, smooth-scroll active link. */

(function () {
  "use strict";

  /* ---------- Command category tabs ---------- */
  const tabs = document.querySelectorAll(".cmd-tab");
  const groups = document.querySelectorAll("[data-cmd-group]");

  if (tabs.length && groups.length) {
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.target;
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        groups.forEach((g) => {
          g.style.display = g.dataset.cmdGroup === target ? "" : "none";
        });
      });
    });
  }

  /* ---------- Waitlist form ---------- */
  const form = document.getElementById("waitlist-form");
  const status = document.getElementById("form-status");
  if (form && status) {
    const ENDPOINT = "/api/waitlist";
    let busy = false;
    let verification = null;
    let challengePromise;
    const submitBtn = form.querySelector('button[type="submit"]');
    const label = submitBtn.textContent;
    const setStatus = (message, error = false) => {
      status.textContent = message;
      status.className = "form-status " + (error ? "err" : "ok");
      status.focus({ preventScroll: true });
    };
    async function refreshChallenge() {
      const response = await fetch(ENDPOINT, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (!response.ok || typeof body.verification !== "string") throw new Error("challenge-unavailable");
      verification = { token: body.verification, at: Date.now() };
      return verification;
    }
    const startChallenge = () => {
      if (!challengePromise) challengePromise = refreshChallenge().catch(() => null).finally(() => { challengePromise = null; });
      return challengePromise;
    };
    form.addEventListener("focusin", () => { if (!verification) startChallenge(); });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      status.textContent = "";
      form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute("aria-invalid"));
      const data = Object.fromEntries(new FormData(form).entries());
      for (const name of ["first_name", "last_name", "email", "business_type"]) {
        const field = form.elements[name];
        if (!String(data[name] || "").trim() || !field.validity.valid) {
          field.setAttribute("aria-invalid", "true");
          setStatus(name === "email" ? "Please enter a valid business email." : "Please fill in all required fields.", true);
          field.focus(); return;
        }
      }
      data.consent = form.elements.consent.checked;
      if (!data.consent) {
        setStatus("Please agree to application-related contact and the privacy notice.", true);
        form.elements.consent.focus(); return;
      }
      busy = true; submitBtn.disabled = true; submitBtn.textContent = "Submitting…";
      form.setAttribute("aria-busy", "true");
      try {
        if (!verification || Date.now() - verification.at > 25 * 60 * 1000) {
          verification = null;
          await startChallenge();
        }
        if (!verification) throw new Error("unavailable");
        const delay = 1800 - (Date.now() - verification.at);
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        data.verification = verification.token;
        const response = await fetch(ENDPOINT, {
          method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(data), signal: AbortSignal.timeout(30000)
        });
        const result = await response.json();
        if (!response.ok || result.accepted !== true) {
          if (result.code === "challenge_expired") verification = null;
          // Only known errors from our own API are displayed, always as text.
          const messages = {
            challenge_expired: "Your form session expired. Please submit again.",
            rate_limited: "Too many attempts. Please try again in an hour.",
            invalid_request: "Please check your details, consent, and selected options, then try again."
          };
          if (messages[result.code]) { setStatus(messages[result.code], true); return; }
          throw new Error("unconfirmed");
        }
        form.reset(); verification = null;
        setStatus("Application received. Your place on the waitlist is saved. We’ll contact you when beta access is available; no response date is guaranteed.");
      } catch {
        setStatus("We could not confirm your application. Your details are still here. Please try again; using the same email will not create a duplicate.", true);
      } finally {
        busy = false; submitBtn.disabled = false; submitBtn.textContent = label;
        form.removeAttribute("aria-busy");
      }
    });
  }

  /* ---------- Footer year ---------- */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
