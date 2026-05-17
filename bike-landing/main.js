(() => {
  const header = document.getElementById("site-header");
  const navToggle = document.getElementById("nav-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  const iconOpen = document.getElementById("nav-icon-open");
  const iconClose = document.getElementById("nav-icon-close");

  /* ---------- Mobile nav toggle ---------- */
  const setMenu = (open) => {
    mobileMenu.classList.toggle("hidden", !open);
    iconOpen.classList.toggle("hidden", open);
    iconClose.classList.toggle("hidden", !open);
    navToggle.setAttribute("aria-expanded", String(open));
  };

  navToggle?.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    setMenu(!isOpen);
  });

  mobileMenu?.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => setMenu(false))
  );

  /* ---------- Sticky header shadow on scroll ---------- */
  const onScroll = () => {
    if (window.scrollY > 8) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  };
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Active section highlight ---------- */
  const sections = ["services", "pricing", "about", "testimonials", "faq", "contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const navLinks = document.querySelectorAll(".nav-link");

  if ("IntersectionObserver" in window && sections.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => io.observe(s));
  }

  /* ---------- Contact form: open user's mail client with a pre-filled message ----------
     No backend on this static site — mailto: keeps the form genuinely useful by handing
     the message off to the visitor's mail app. Replace with a real endpoint if/when
     the shop wires up a form service (Formspree, Netlify Forms, etc.). */
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");
  const SHOP_EMAIL = "hello@ridgelinecycles.example";

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const get = (n) =>
      /** @type {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} */ (
        form.elements.namedItem(n)
      ).value.trim();

    const name = get("name");
    const email = get("email");
    const service = get("service");
    const message = get("message");

    const subject = `Booking enquiry — ${service}`;
    const body =
      `Hi Ridgeline Cycles,\n\n${message}\n\n` +
      `— ${name}\nReply to: ${email}`;

    window.location.href =
      `mailto:${SHOP_EMAIL}?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    status.textContent = `Thanks, ${name || "rider"}! Your mail app should open with the message ready to send.`;
    status.classList.remove("hidden");
    form.reset();
  });

  /* ---------- Pricing CTAs pre-fill the service dropdown ---------- */
  document.querySelectorAll("[data-book-tier]").forEach((el) => {
    el.addEventListener("click", () => {
      const tier = el.getAttribute("data-book-tier");
      const select = /** @type {HTMLSelectElement|null} */ (document.getElementById("service"));
      if (!select || !tier) return;
      const match = Array.from(select.options).find((o) => o.value === tier || o.text === tier);
      if (match) select.value = match.value || match.text;
    });
  });

  /* ---------- Scroll-reveal: subtle fade-in on sections ---------- */
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    const revealTargets = document.querySelectorAll("[data-reveal]");
    const revealer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            revealer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    revealTargets.forEach((t) => revealer.observe(t));
  } else {
    // Reduced motion or no observer: show everything immediately
    document.querySelectorAll("[data-reveal]").forEach((t) => t.classList.add("is-revealed"));
  }

  /* ---------- Year in footer ---------- */
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
