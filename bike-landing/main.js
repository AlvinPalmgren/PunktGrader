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
  const desktop = window.matchMedia("(min-width: 768px)");
  document.querySelectorAll("[data-book-tier]").forEach((el) => {
    el.addEventListener("click", () => {
      const tier = el.getAttribute("data-book-tier");
      const select = /** @type {HTMLSelectElement|null} */ (document.getElementById("service"));
      if (!select || !tier) return;
      // <option> without an explicit value attr reports its text content as .value
      if (Array.from(select.options).some((o) => o.value === tier)) {
        select.value = tier;
      }
      // On desktop, focus the name field so the user can start typing right
      // away. Skipped on mobile because focusing an input pops the on-screen
      // keyboard, which would cover the form they just scrolled to.
      if (desktop.matches) {
        const name = document.getElementById("name");
        if (name) {
          // Wait for the anchor-scroll to start so focus doesn't fight it.
          setTimeout(() => name.focus({ preventScroll: true }), 100);
        }
      }
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

  /* ---------- Open / Closed indicator -----------
     Hours match the JSON-LD + the visible text in the contact section.
     Day index: 0=Sun, 1=Mon, ... 6=Sat. Hours are local time. */
  const HOURS = {
    1: null,            // Mon — closed
    2: [9 * 60, 18 * 60], // Tue
    3: [9 * 60, 18 * 60], // Wed
    4: [9 * 60, 18 * 60], // Thu
    5: [9 * 60, 18 * 60], // Fri
    6: [9 * 60, 16 * 60], // Sat
    0: null,            // Sun — closed
  };

  const fmt = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const updateOpenStatus = () => {
    const badge = document.getElementById("open-status");
    if (!badge) return;
    const label = badge.querySelector(".open-status__label");
    const now = new Date();
    const todays = HOURS[now.getDay()];
    const nowMin = now.getHours() * 60 + now.getMinutes();

    badge.classList.remove("open-status--open", "open-status--closed", "open-status--unknown");

    if (todays && nowMin >= todays[0] && nowMin < todays[1]) {
      badge.classList.add("open-status--open");
      label.textContent = `Open · until ${fmt(todays[1])}`;
    } else {
      badge.classList.add("open-status--closed");
      // Find the next opening day (look up to 7 days ahead)
      for (let i = 1; i <= 7; i++) {
        const dow = (now.getDay() + i) % 7;
        if (HOURS[dow]) {
          const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          label.textContent = `Closed · opens ${dayNames[dow]} ${fmt(HOURS[dow][0])}`;
          return;
        }
      }
      label.textContent = "Closed";
    }
  };

  updateOpenStatus();
  setInterval(updateOpenStatus, 60_000);

  /* ---------- Animated number counters in the About stats ----------
     Initial HTML carries the final value (graceful no-JS). With JS, the
     values reset to 0 and ease up to target when the stat enters viewport. */
  const counters = document.querySelectorAll("[data-count-to]");
  const fmtCount = (el, v) => {
    const decimals = parseInt(el.dataset.countDecimals || "0", 10);
    if (el.dataset.countFmt === "comma") {
      el.textContent = Math.round(v).toLocaleString();
    } else {
      el.textContent = v.toFixed(decimals);
    }
  };

  if (counters.length) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      counters.forEach((el) => fmtCount(el, parseFloat(el.dataset.countTo)));
    } else {
      counters.forEach((el) => fmtCount(el, 0));
      const animate = (el) => {
        const target = parseFloat(el.dataset.countTo);
        const duration = 1200;
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
          fmtCount(el, target * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      const seen = new WeakSet();
      const countObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && !seen.has(e.target)) {
              seen.add(e.target);
              animate(e.target);
              countObs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach((el) => countObs.observe(el));
    }
  }

  /* ---------- Open all FAQs while printing, restore after ---------- */
  window.addEventListener("beforeprint", () => {
    document.querySelectorAll("details").forEach((d) => {
      d.dataset.wasOpen = String(d.open);
      d.open = true;
    });
  });
  window.addEventListener("afterprint", () => {
    document.querySelectorAll("details").forEach((d) => {
      d.open = d.dataset.wasOpen === "true";
      delete d.dataset.wasOpen;
    });
  });

  /* ---------- Drop images that fail to load -----------
     Container has a background colour fallback; removing the broken <img>
     stops the alt text + missing-image icon from overlapping other content. */
  document.querySelectorAll("img[data-bg-fallback]").forEach((img) => {
    img.addEventListener("error", () => img.remove(), { once: true });
  });

  /* ---------- Year in footer ---------- */
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
