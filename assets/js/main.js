/* =========================================================================
   Nikko Sudirman, portfolio
   Motion, hero showpiece, scroll-spy, accordion, lightbox.

   Design rules this file follows:
   - No HTML is ever built from strings. Text goes in via textContent and
     attributes via setAttribute, so data-* values can never become markup.
   - Every third-party library is optional. If gsap, ScrollTrigger or Lenis
     fail to load, the page stays fully readable and operable.
   - Content is visible by default. JavaScript hides things (collapsed panels,
     pre-animation opacity), never the other way round.
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- small helpers ---------- */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };
  /* run fn at most once per animation frame */
  function rafThrottle(fn) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fn(); });
    };
  }

  var root = document.documentElement;
  var hasGSAP = typeof window.gsap !== "undefined";
  var hasST = hasGSAP && typeof window.ScrollTrigger !== "undefined";
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = motionQuery.matches;
  var animate = hasGSAP && !reduce;
  /* Scroll-driven reveals need BOTH gsap and ScrollTrigger. If either file
     fails, fall back to "everything visible" rather than hiding content. */
  var scrollFx = animate && hasST;

  root.classList.add(scrollFx ? "gsap-ready" : "no-gsap");
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------------------
     Smooth scroll (Lenis). Entirely optional.
     --------------------------------------------------------------------- */
  var lenis = null;
  if (typeof window.Lenis !== "undefined" && !reduce) {
    lenis = new Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });
    if (hasST) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(t) { lenis.raf(t); requestAnimationFrame(raf); });
    }
  }

  /* In-page links. Also moves keyboard focus to the destination, which a
     plain scroll does not do. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute("href");
    /* let the skip link use native behaviour so focus lands instantly */
    if (id === "#" || id === "#main") return;

    var el = document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();

    if (lenis) lenis.scrollTo(el, { offset: -72 });
    else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });

    history.replaceState(null, "", id);
  });

  /* ---------------------------------------------------------------------
     Top bar state
     --------------------------------------------------------------------- */
  (function topbar() {
    var bar = document.getElementById("topbar");
    if (!bar) return;
    var update = rafThrottle(function () {
      bar.dataset.stuck = window.scrollY > 24 ? "true" : "false";
    });
    update();
    window.addEventListener("scroll", update, { passive: true });
  })();

  /* ---------------------------------------------------------------------
     Hero showpiece: isometric blueprint tower on canvas
     --------------------------------------------------------------------- */
  (function heroCanvas() {
    var cv = document.getElementById("heroCanvas");
    if (!cv || reduce) return;
    var host = cv.parentElement;
    if (!host) return;

    var ctx = cv.getContext("2d");
    if (!ctx) return;

    var W = 0, H = 0;
    var t0 = performance.now();
    var mx = 0, my = 0;   // target parallax, -1..1
    var cx = 0, cy = 0;   // eased parallax
    var raf = null;
    var inView = true;    // hero intersects the viewport
    var painted = true;   // CSS is not display:none (phones hide the canvas)

    /* building definition: plan footprints in abstract units, z is floor index */
    var PODIUM = [[-2.2, -1.55], [2.2, -1.55], [2.2, 1.55], [-2.2, 1.55]];
    var TOWER  = [[-1.4, -1.15], [1.4, -1.15], [1.4, 1.15], [-1.4, 1.15]];
    var PODIUM_FLOORS = 5;
    var TOWER_FLOORS = 22;
    var TOTAL = PODIUM_FLOORS + TOWER_FLOORS;
    var FLOOR_PITCH = 0.34;   // storey height as a fraction of plan scale

    /* 1.5 is the point of diminishing returns for 1px hairlines; going to the
       full device ratio on a 3x phone quadruples fill cost for no visible gain */
    var MAX_DPR = 1.5;

    function measure() {
      var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      W = cv.clientWidth;
      H = cv.clientHeight;
      painted = W > 0 && H > 0;
      if (!painted) return;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    var resize = rafThrottle(function () { measure(); sync(); });

    function project(p, z, yaw, tilt, scale, ox, oy) {
      var c = Math.cos(yaw), s = Math.sin(yaw);
      var x = p[0] * c - p[1] * s;
      var y = p[0] * s + p[1] * c;
      return [
        ox + (x - y) * 0.866 * scale,
        oy + (x + y) * tilt * scale - z * scale * FLOOR_PITCH
      ];
    }

    function drawGrid() {
      var step = 46;
      ctx.save();
      ctx.strokeStyle = "rgba(29,78,216,0.055)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = 0; x <= W; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
      for (var y = 0; y <= H; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
      ctx.stroke();

      /* fade the grid out toward the left, where the headline sits */
      var g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "rgba(244,242,237,1)");
      g.addColorStop(0.42, "rgba(244,242,237,0.72)");
      g.addColorStop(1, "rgba(244,242,237,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function draw(now) {
      raf = requestAnimationFrame(draw);

      var el = (now - t0) / 1000;
      var intro = Math.min(1, el / 2.4);
      var eased = 1 - Math.pow(1 - intro, 3);

      cx += (mx - cx) * 0.055;
      cy += (my - cy) * 0.055;

      ctx.clearRect(0, 0, W, H);
      drawGrid();

      var narrow = W < 900;
      /* The hero is usually taller than the viewport, so anchor the stack to
         the visible band rather than the section box. */
      var vh = Math.min(H, window.innerHeight);
      var scale = Math.min(W * (narrow ? 0.06 : 0.038), vh * 0.56 / (TOTAL * FLOOR_PITCH));
      var towerH = TOTAL * FLOOR_PITCH * scale;
      /* sits clear of the headline's longest line on the left */
      var ox = narrow ? W * 0.5 : W * 0.79;
      var oy = (vh - towerH) / 2 + towerH;

      var yaw = el * 0.045 + cx * 0.36;
      var tilt = 0.5 + cy * 0.09;

      var baseAlpha = narrow ? 0.4 : 1;
      ctx.lineWidth = 1;
      ctx.lineJoin = "round";

      for (var i = 0; i < TOTAL; i++) {
        var appear = (i / TOTAL) * 0.75;
        var k = (eased - appear) / 0.25;
        if (k <= 0) continue;
        k = Math.min(1, k);

        var plan = i < PODIUM_FLOORS ? PODIUM : TOWER;
        var isCap = i === PODIUM_FLOORS - 1 || i === TOTAL - 1 || i % 6 === 0;
        var pts = [];
        for (var j = 0; j < plan.length; j++) {
          pts.push(project(plan[j], i, yaw, tilt, scale, ox, oy));
        }

        ctx.strokeStyle = "rgba(29,78,216," + (baseAlpha * k * (isCap ? 0.34 : 0.15)).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var m = 1; m < pts.length; m++) ctx.lineTo(pts[m][0], pts[m][1]);
        ctx.closePath();
        ctx.stroke();

        if (isCap) {
          ctx.fillStyle = "rgba(29,78,216," + (baseAlpha * k * 0.035).toFixed(3) + ")";
          ctx.fill();
        }

        if (i > 0) {
          var planBelow = (i - 1) < PODIUM_FLOORS ? PODIUM : TOWER;
          ctx.strokeStyle = "rgba(22,24,28," + (baseAlpha * k * 0.12).toFixed(3) + ")";
          ctx.beginPath();
          for (var c2 = 0; c2 < plan.length; c2++) {
            var below = project(planBelow[Math.min(c2, planBelow.length - 1)], i - 1,
                                yaw, tilt, scale, ox, oy);
            ctx.moveTo(below[0], below[1]);
            ctx.lineTo(pts[c2][0], pts[c2][1]);
          }
          ctx.stroke();
        }

        if (isCap && k > 0.9) {
          ctx.fillStyle = "rgba(29,78,216," + (baseAlpha * 0.5).toFixed(3) + ")";
          for (var n = 0; n < pts.length; n++) {
            ctx.beginPath();
            ctx.arc(pts[n][0], pts[n][1], 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      /* ground datum cross */
      if (eased > 0.1) {
        var a = Math.min(1, (eased - 0.1) / 0.3) * baseAlpha * 0.22;
        ctx.strokeStyle = "rgba(29,78,216," + a.toFixed(3) + ")";
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        var g0 = project([-4.1, 0], -0.6, yaw, tilt, scale, ox, oy);
        var g1 = project([4.1, 0], -0.6, yaw, tilt, scale, ox, oy);
        var g2 = project([0, -4.1], -0.6, yaw, tilt, scale, ox, oy);
        var g3 = project([0, 4.1], -0.6, yaw, tilt, scale, ox, oy);
        ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]);
        ctx.moveTo(g2[0], g2[1]); ctx.lineTo(g3[0], g3[1]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    /* Start and stop the loop outright rather than running an rAF that
       immediately returns. Nothing is scheduled while the hero is off screen,
       the tab is in the background, or CSS has hidden the canvas. */
    function sync() {
      var shouldRun = inView && painted && !document.hidden && !motionQuery.matches;
      if (shouldRun && raf === null) {
        raf = requestAnimationFrame(draw);
      } else if (!shouldRun && raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    }

    measure();
    window.addEventListener("resize", resize);
    /* fonts and images can settle after first paint, so re-measure rather than
       trusting the very first layout pass */
    window.addEventListener("load", resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);

    window.addEventListener("pointermove", function (e) {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0 }).observe(host);
    }

    document.addEventListener("visibilitychange", sync);
    if (motionQuery.addEventListener) motionQuery.addEventListener("change", sync);

    sync();
  })();

  /* ---------------------------------------------------------------------
     Entrance motion
     --------------------------------------------------------------------- */
  if (animate) {
    var lines = gsap.utils.toArray(".hero-title .line > span");
    if (lines.length) {
      gsap.set(lines, { yPercent: 108 });
      var tl = gsap.timeline({ delay: 0.15 });
      tl.to(lines, {
        yPercent: 0,
        duration: 1.15,
        ease: "expo.out",
        stagger: 0.085,
        onComplete: function () {
          /* let the chip shadows breathe once the mask has done its job */
          $$(".hero-title .line").forEach(function (l) { l.style.overflow = "visible"; });
        }
      });
      gsap.set(".hero-sub, .hero-actions, .hero-meta", { y: 18 });
      tl.to(".hero-sub, .hero-actions, .hero-meta", {
        opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1
      }, "-=0.75");
    }

    if (scrollFx) {
      gsap.utils.toArray("[data-reveal]").forEach(function (el) {
        if (el.closest(".hero")) return;
        gsap.fromTo(el,
          { opacity: 0, y: 26 },
          {
            opacity: 1, y: 0, duration: 0.85, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true }
          });
      });

      gsap.utils.toArray(".cap-grid, .proj-grid").forEach(function (grid) {
        gsap.fromTo(grid.children,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.07,
            scrollTrigger: { trigger: grid, start: "top 82%", once: true }
          });
      });

      var tlLine = document.getElementById("tlLine");
      if (tlLine) {
        gsap.to(tlLine, {
          scaleY: 1, ease: "none",
          scrollTrigger: { trigger: "#timeline", start: "top 72%", end: "bottom 78%", scrub: 0.6 }
        });
      }

      gsap.utils.toArray(".proj-media img").forEach(function (img) {
        gsap.fromTo(img,
          { yPercent: -3.5 },
          {
            yPercent: 3.5, ease: "none",
            scrollTrigger: { trigger: img, start: "top bottom", end: "bottom top", scrub: true }
          });
      });
    }
  }

  /* ---------------------------------------------------------------------
     Section rail scroll-spy
     --------------------------------------------------------------------- */
  (function spy() {
    var rail = document.getElementById("rail");
    var links = $$(".rail a");
    if (!rail || !links.length || !window.IntersectionObserver) return;

    var targets = [];
    links.forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var el = href.length > 1 ? document.getElementById(href.slice(1)) : null;
      if (el) targets.push(el);
    });

    function setCurrent(id) {
      links.forEach(function (a) {
        a.setAttribute("aria-current", a.getAttribute("href") === "#" + id ? "true" : "false");
      });
    }
    setCurrent("top");

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) setCurrent(en.target.id);
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    targets.forEach(function (t) { io.observe(t); });

    /* The rail is fixed at mid-viewport and passes over the dark band.
       Invert its colours while it does, or the labels disappear. */
    var darkBands = $$(".band-dark");
    if (!darkBands.length) return;
    var checkDark = rafThrottle(function () {
      var mid = window.innerHeight / 2;
      var over = darkBands.some(function (b) {
        var r = b.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid;
      });
      rail.classList.toggle("on-dark", over);
    });
    checkDark();
    window.addEventListener("scroll", checkDark, { passive: true });
    window.addEventListener("resize", checkDark);
  })();

  /* ---------------------------------------------------------------------
     Experience accordion

     Panels are open in CSS so the content is readable without JavaScript.
     This collapses the closed ones on load and keeps aria-expanded, the
     panel height and `inert` in step from then on.
     --------------------------------------------------------------------- */
  (function accordion() {
    var supportsInert = "inert" in HTMLElement.prototype;

    $$(".job").forEach(function (job) {
      var head = $(".job-head", job);
      var panel = $(".job-detail", job);
      var inner = $(".job-detail-inner", job);
      if (!head || !panel || !inner) return;

      var open = job.classList.contains("is-open");

      /* keep a collapsed panel out of the tab order and the accessibility
         tree; aria-hidden is the fallback where `inert` is unsupported */
      function setInert(isOpen) {
        if (supportsInert) panel.inert = !isOpen;
        else if (isOpen) panel.removeAttribute("aria-hidden");
        else panel.setAttribute("aria-hidden", "true");
      }

      function applyState(isOpen) {
        job.classList.toggle("is-open", isOpen);
        head.setAttribute("aria-expanded", String(isOpen));
        setInert(isOpen);
      }

      panel.style.height = open ? "auto" : "0px";
      applyState(open);

      head.addEventListener("click", function () {
        open = !open;
        applyState(open);

        if (!animate) {
          panel.style.height = open ? "auto" : "0px";
          if (hasST) ScrollTrigger.refresh();
          return;
        }

        gsap.killTweensOf(panel);
        if (open) {
          gsap.fromTo(panel,
            { height: 0 },
            {
              height: inner.offsetHeight,
              duration: 0.55, ease: "power3.inOut",
              onComplete: function () {
                /* back to auto so the panel reflows if the window resizes */
                panel.style.height = "auto";
                if (hasST) ScrollTrigger.refresh();
              }
            });
          gsap.fromTo(inner.querySelectorAll(".achv > li, .chips-label, .proj-chips"),
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.05, delay: 0.12 });
        } else {
          gsap.fromTo(panel,
            { height: panel.offsetHeight },
            {
              height: 0, duration: 0.45, ease: "power3.inOut",
              onComplete: function () { if (hasST) ScrollTrigger.refresh(); }
            });
        }
      });
    });
  })();

  /* ---------------------------------------------------------------------
     Project lightbox
     --------------------------------------------------------------------- */
  (function lightbox() {
    var dlg = document.getElementById("lightbox");
    if (!dlg || typeof dlg.showModal !== "function") return;

    var imgEl = document.getElementById("lbImg");
    var titleEl = document.getElementById("lbTitle");
    var metaEl = document.getElementById("lbMeta");
    var descEl = document.getElementById("lbDesc");
    var countEl = document.getElementById("lbCount");
    var prevBtn = document.getElementById("lbPrev");
    var nextBtn = document.getElementById("lbNext");
    var closeBtn = document.getElementById("lbClose");
    if (!imgEl || !titleEl || !descEl || !countEl || !prevBtn || !nextBtn || !closeBtn) return;

    /* Image stems are used to build a URL, so restrict them to a known-safe
       shape. This blocks path traversal and protocol tricks if a data-gallery
       attribute is ever edited carelessly. */
    var SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

    /* Parse defensively: a malformed entry is dropped, a malformed attribute
       yields an empty gallery, and neither takes the rest of the page down. */
    function parseGallery(raw) {
      if (!raw) return [];
      var data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        if (window.console) console.warn("Lightbox: gallery JSON is not parseable.", err);
        return [];
      }
      if (!Array.isArray(data)) {
        if (window.console) console.warn("Lightbox: gallery data is not an array.");
        return [];
      }
      var clean = [];
      data.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        if (typeof item.src !== "string" || !SAFE_SLUG.test(item.src)) {
          if (window.console) console.warn("Lightbox: skipping entry with an unusable src.", item);
          return;
        }
        clean.push({
          src: item.src,
          cap: typeof item.cap === "string" ? item.cap : ""
        });
      });
      return clean;
    }

    var gallery = [];
    var index = 0;
    var opener = null;
    var baseDesc = "";

    function render() {
      var item = gallery[index];
      if (!item) return;
      var multi = gallery.length > 1;

      imgEl.setAttribute("src", "assets/img/projects/" + item.src + ".webp");
      imgEl.setAttribute("alt", item.cap || baseDesc);
      descEl.textContent = multi && item.cap ? item.cap : baseDesc;
      countEl.textContent = multi ? (index + 1) + " of " + gallery.length : "";
      prevBtn.hidden = !multi;
      nextBtn.hidden = !multi;

      if (animate) {
        gsap.fromTo(imgEl, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      }
    }

    function step(dir) {
      if (gallery.length < 2) return;
      index = (index + dir + gallery.length) % gallery.length;
      render();
    }

    $$(".proj-card").forEach(function (card) {
      var trigger = $(".proj-trigger", card);
      if (!trigger) return;

      trigger.addEventListener("click", function () {
        var items = parseGallery(card.getAttribute("data-gallery"));
        if (!items.length) return;   // nothing to show, leave the page as it is

        gallery = items;
        index = 0;
        opener = trigger;
        baseDesc = card.getAttribute("data-desc") || "";
        titleEl.textContent = card.getAttribute("data-title") || "";
        if (metaEl) metaEl.textContent = card.getAttribute("data-meta") || "";

        render();
        if (lenis) lenis.stop();
        root.classList.add("lb-open");   // stop the page behind scrolling
        dlg.showModal();                 // native modal: focus trap + Escape
      });
    });

    closeBtn.addEventListener("click", function () { dlg.close(); });
    prevBtn.addEventListener("click", function () { step(-1); });
    nextBtn.addEventListener("click", function () { step(1); });

    /* click the backdrop to dismiss */
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });

    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    });

    dlg.addEventListener("close", function () {
      root.classList.remove("lb-open");
      if (lenis) lenis.start();
      if (opener) opener.focus();
      opener = null;
    });
  })();

  /* ---------------------------------------------------------------------
     Magnetic buttons: desktop pointer only, decorative
     --------------------------------------------------------------------- */
  if (animate && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".btn").forEach(function (btn) {
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (e.clientX - r.left - r.width / 2) * 0.18,
          y: (e.clientY - r.top - r.height / 2) * 0.22,
          duration: 0.5, ease: "power3.out"
        });
      });
      btn.addEventListener("pointerleave", function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      });
    });
  }
})();
