// ===== NAV SCROLL =====
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
});

// ===== MOBILE MENU =====
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('open');
}

// Close menu on outside click
document.addEventListener('click', (e) => {
  const menu = document.getElementById('mobileMenu');
  const burger = document.querySelector('.nav-burger');
  if (!menu.contains(e.target) && !burger.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ===== SCROLL REVEAL =====
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

// Add reveal class to sections
document.querySelectorAll('.problem-card, .feature-card, .feature-main, .pricing-card').forEach((el, i) => {
  el.classList.add('reveal');
  el.style.transitionDelay = `${i * 0.06}s`;
  revealObserver.observe(el);
});

// ===== WAITLIST FORM =====
function submitWaitlist(e) {
  e.preventDefault();

  const btn = document.getElementById('submitBtn');
  const form = document.getElementById('waitlistForm');
  const success = document.getElementById('successMsg');

  const name = document.getElementById('wlName').value;
  const email = document.getElementById('wlEmail').value;
  const type = document.getElementById('wlType').value;

  // Button loading state
  btn.textContent = 'Joining the pack...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  // Simulate submission (replace with your actual endpoint)
  setTimeout(() => {
    // Hide form, show success
    form.style.display = 'none';
    success.classList.add('visible');

    // Optional: Send to a service like Formspree or EmailJS
    // sendToFormspree(name, email, type);

    console.log('Waitlist signup:', { name, email, type });
  }, 1500);
}

// ===== SMOOTH ANCHOR SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ===== OPTIONAL: Connect to Formspree =====
// Uncomment and replace YOUR_FORM_ID to enable real email collection:
//
// async function sendToFormspree(name, email, type) {
//   await fetch('https://formspree.io/f/YOUR_FORM_ID', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ name, email, businessType: type })
//   });
// }

// ===== OPTIONAL: Connect to EmailJS =====
// Uncomment to use EmailJS for instant email notifications:
//
// emailjs.init("YOUR_PUBLIC_KEY");
// async function sendEmail(name, email, type) {
//   await emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
//     from_name: name,
//     from_email: email,
//     business_type: type
//   });
// }
