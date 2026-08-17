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
     Preloader

     Counts 0 to 100 across the foot of the screen, then retracts upward to
     reveal the page. Runs first, because the stylesheet is holding a 3s
     failsafe that clears the panel on its own and this is what calls it off.

     The count is tied to the real `load` event rather than being pure theatre:
     it crawls asymptotically toward 90 while assets are still arriving and
     only completes once the browser says the page is loaded. MIN_MS stops a
     warm cache reducing it to a flash; MAX_MS stops one slow CDN file holding
     the whole page shut.
     --------------------------------------------------------------------- */
  (function preloader() {
    var el = document.getElementById("preloader");
    if (!el) return;
    var countEl = document.getElementById("preloadCount");

    /* from here the script owns the panel, so stand the CSS failsafe down */
    root.classList.add("preload-js");

    function remove() {
      root.classList.remove("preloading");
      if (el.parentNode) el.parentNode.removeChild(el);
    }

    /* reduced motion gets the page, not the performance */
    if (reduce || !countEl) { remove(); return; }

    var MIN_MS = 1100;      // long enough to register, short enough not to grate
    var MAX_MS = 4000;      // hard ceiling: never hold the page shut past this
    var HOLD_MS = 1000;     // the beat on 100 before the panel fades away
    var FADE_MS = 700;      // must match the transition in the stylesheet
    var FAILSAFE_MS = 2000; // must match the animation delay in the stylesheet

    /* If this script only got going after the stylesheet's failsafe was due,
       the connection is slow enough that the page is the thing worth showing.
       Bail out rather than let `animation: none` snap a half-faded panel back
       to full opacity and start a countdown the visitor has already waited
       through. performance.now() here is time since navigation started. */
    if (performance.now() >= FAILSAFE_MS) { remove(); return; }

    root.classList.add("preloading");

    var start = performance.now();
    var loaded = document.readyState === "complete";
    var shown = 0;
    var raf = null;

    if (!loaded) {
      window.addEventListener("load", function () { loaded = true; });
    }

    function target(elapsed) {
      if (elapsed >= MAX_MS) return 100;
      if (loaded && elapsed >= MIN_MS) return 100;
      /* never pretends to be finished: 90 is the asymptote until `load` */
      return Math.min(90, 90 * (1 - Math.exp(-elapsed / 900)));
    }

    function frame(now) {
      var want = target(now - start);
      shown += (want - shown) * 0.09;
      if (want === 100 && want - shown < 0.4) shown = 100;

      var v = Math.min(100, Math.round(shown));
      countEl.textContent = String(v);
      /* CSSOM, not a style attribute, so the documented CSP still holds */
      el.style.setProperty("--p", (v / 100).toFixed(4));

      if (v >= 100) {
        raf = null;
        /* settle on 100, hold, then fade the panel out */
        setTimeout(function () {
          el.classList.add("is-leaving");
          /* +80ms so the node only goes once the fade has actually finished */
          setTimeout(remove, FADE_MS + 80);
        }, HOLD_MS);
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  })();

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
     Sample viewer

     One dialog shared by every "see a sample" trigger. The iframe src is set
     on open and cleared on close, so nothing loads until asked and a closed
     dialog is not left streaming in the background.

     A trigger with no data-viewer-src is removed rather than shown dead, which
     is how the video trigger stays out of the way until a URL exists.
     --------------------------------------------------------------------- */
  (function sampleViewer() {
    var dlg = document.getElementById("viewer");
    /* Two kinds of trigger open the same viewer: the "see a sample" buttons on
       the Design Technology cases, and any project card that carries its own
       portfolio pages instead of an image gallery. */
    var triggers = $$(".case-cta")
      .concat($$(".proj-card[data-viewer-pages] .proj-trigger"));
    if (!triggers.length) return;

    /* No dialog support, or no dialog at all: leave the triggers off the page
       rather than offer a button that does nothing. */
    if (!dlg || typeof dlg.showModal !== "function") {
      triggers.forEach(function (t) { t.hidden = true; });
      return;
    }

    var frame = document.getElementById("viewerFrame");
    var video = document.getElementById("viewerVideo");
    var pages = document.getElementById("viewerPages");
    var pageImg = document.getElementById("viewerPageImg");
    var pagePrev = document.getElementById("viewerPrev");
    var pageNext = document.getElementById("viewerNext");
    var titleEl = document.getElementById("viewerTitle");
    var metaEl = document.getElementById("viewerMeta");
    var noteEl = document.getElementById("viewerNote");
    var countEl = document.getElementById("viewerCount");
    var closeBtn = document.getElementById("viewerClose");
    var zoomBox = document.getElementById("viewerZoom");
    var zoomInBtn = document.getElementById("viewerZoomIn");
    var zoomOutBtn = document.getElementById("viewerZoomOut");
    var zoomLevelEl = document.getElementById("viewerZoomLevel");
    if (!frame || !titleEl || !closeBtn) return;

    var opener = null;

    var NOTE = {
      doc: "Sample document, shown read-only in this window. Use the arrows or the left/right keys to page through.",
      video: "Sample recording, played in this window.",
      project: "Portfolio pages for this project. Use the arrows or the left/right keys to page through."
    };

    /* Paged document state: one page image at a time, like the project
       lightbox, rather than a long scrolling stack. */
    var pageBase = "", pageTitle = "", pageTotal = 0, pageIndex = 0;

    /* Zoom state. fitWidth is the image's rendered width at 1x (fit to the
       box, whatever its aspect ratio), measured fresh off the box the first
       time a page is zoomed rather than computed, so it is exact regardless
       of viewport size or page shape. It resets to 0 on every page change so
       the next zoom-in re-measures against the new page. */
    var ZOOM_MIN = 1, ZOOM_MAX = 3, ZOOM_STEP = 0.5;
    var zoom = 1, fitWidth = 0;

    function applyZoom() {
      if (!pages || !pageImg) return;
      var zoomed = zoom > 1;
      pages.classList.toggle("is-zoomed", zoomed);
      pageImg.style.width = zoomed && fitWidth ? (fitWidth * zoom) + "px" : "";
      if (!zoomed) { pages.scrollLeft = 0; pages.scrollTop = 0; }
      if (zoomLevelEl) zoomLevelEl.textContent = Math.round(zoom * 100) + "%";
      if (zoomOutBtn) zoomOutBtn.disabled = zoom <= ZOOM_MIN;
      if (zoomInBtn) zoomInBtn.disabled = zoom >= ZOOM_MAX;
    }

    function setZoom(z) {
      if (!pageImg) return;
      if (!fitWidth) fitWidth = pageImg.getBoundingClientRect().width;
      zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
      applyZoom();
    }

    function zoomReset() {
      zoom = 1;
      fitWidth = 0;
      applyZoom();
    }

    function renderPage() {
      if (!pages || !pageImg) return;
      zoomReset();
      var n = pageIndex + 1;
      pageImg.setAttribute("src", pageBase + n + ".webp");
      pageImg.setAttribute("alt", pageTitle + ", page " + n + " of " + pageTotal);
      if (countEl) countEl.textContent = pageTotal > 1 ? n + " of " + pageTotal : "";
      var multi = pageTotal > 1;
      if (pagePrev) pagePrev.hidden = !multi;
      if (pageNext) pageNext.hidden = !multi;
      if (animate) {
        gsap.fromTo(pageImg, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" });
      }
    }

    function stepPage(dir) {
      if (pageTotal < 2) return;
      pageIndex = (pageIndex + dir + pageTotal) % pageTotal;
      renderPage();
    }

    triggers.forEach(function (btn) {
      /* A case button carries its own data. A project trigger is a bare button
         inside the card, so read the card's attributes instead. */
      var host = btn.closest ? (btn.closest("[data-viewer-pages]") || btn) : btn;
      var src = host.getAttribute("data-viewer-src");
      var pageCount = parseInt(host.getAttribute("data-viewer-pages"), 10);
      var pageBaseAttr = host.getAttribute("data-viewer-base");
      var isDoc = pageCount > 0 && pageBaseAttr;
      if (!src && !isDoc) {
        /* An unwired case button is hidden; a project trigger is left alone so
           the card still behaves normally. */
        if (btn.classList.contains("case-cta")) btn.hidden = true;
        return;
      }

      btn.addEventListener("click", function () {
        var title = host.getAttribute("data-viewer-title") ||
                    host.getAttribute("data-title") || "";
        titleEl.textContent = title;
        if (metaEl) {
          metaEl.textContent = host.getAttribute("data-viewer-meta") ||
                               host.getAttribute("data-meta") || "";
        }
        if (noteEl) {
          var kind = host.getAttribute("data-viewer-kind") ||
                     (host.classList.contains("proj-card") ? "project" : "doc");
          noteEl.textContent = NOTE[kind] || "";
        }
        /* A local video belongs in the video element, not an iframe: an
           iframed mp4 gets the browser's bare player with a download button
           and no poster. A document pages through one image at a time,
           because an embedded PDF is at the mercy of the visitor's browser
           settings. Anything else goes to the frame. */
        var useVideo = video && btn.getAttribute("data-viewer-kind") === "video" &&
                       !/^https?:\/\//i.test(src);

        if (isDoc && pages && pageImg) {
          frame.hidden = true;
          frame.removeAttribute("src");
          if (video) { video.hidden = true; video.removeAttribute("src"); }
          pageBase = pageBaseAttr;
          pageTitle = title;
          pageTotal = pageCount;
          pageIndex = 0;
          pages.hidden = false;
          if (zoomBox) zoomBox.hidden = false;
          renderPage();
        } else if (useVideo) {
          frame.hidden = true;
          frame.removeAttribute("src");
          if (pages) pages.hidden = true;
          if (zoomBox) zoomBox.hidden = true;
          if (pagePrev) pagePrev.hidden = true;
          if (pageNext) pageNext.hidden = true;
          video.hidden = false;
          var poster = host.getAttribute("data-viewer-poster");
          if (poster) { video.setAttribute("poster", poster); }
          else { video.removeAttribute("poster"); }
          video.setAttribute("src", src);
        } else {
          if (pages) pages.hidden = true;
          if (zoomBox) zoomBox.hidden = true;
          if (pagePrev) pagePrev.hidden = true;
          if (pageNext) pageNext.hidden = true;
          video && (video.hidden = true, video.removeAttribute("src"));
          frame.hidden = false;
          frame.setAttribute("title", title);
          /* Sandbox third-party embeds only. Applying it to a same-origin PDF
             stops Chrome's built-in viewer rendering it. */
          if (/^https?:\/\//i.test(src)) {
            frame.setAttribute("sandbox",
              "allow-scripts allow-same-origin allow-presentation");
          } else {
            frame.removeAttribute("sandbox");
          }
          frame.setAttribute("src", src);
        }

        opener = btn;
        if (lenis) lenis.stop();
        root.classList.add("lb-open");   // reuse the existing scroll lock
        dlg.showModal();
      });
    });

    if (pagePrev) pagePrev.addEventListener("click", function () { stepPage(-1); });
    if (pageNext) pageNext.addEventListener("click", function () { stepPage(1); });

    if (zoomInBtn) zoomInBtn.addEventListener("click", function () { setZoom(zoom + ZOOM_STEP); });
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", function () { setZoom(zoom - ZOOM_STEP); });
    if (pageImg) {
      pageImg.addEventListener("dblclick", function () { setZoom(zoom > 1 ? 1 : 2); });
    }

    /* Drag to pan once zoomed, mouse only: .viewer-pages is overflow:auto
       when zoomed, so touch already pans it natively, with momentum and
       bounce a hand-rolled version would not have. Engaging this for touch
       too would call setPointerCapture on every touch drag and fight that
       native scrolling instead of adding to it. Pointer capture keeps the
       drag going even if the cursor leaves the image mid-gesture. The
       nav/zoom buttons are siblings of .viewer-pages, not descendants of it
       (see the HTML), so a pointerdown on them never reaches this listener
       and needs no guard. */
    var panning = false, panStartX = 0, panStartY = 0, panScrollX = 0, panScrollY = 0;
    if (pages) {
      pages.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "touch") return;
        if (!pages.classList.contains("is-zoomed")) return;
        panning = true;
        panStartX = e.clientX; panStartY = e.clientY;
        panScrollX = pages.scrollLeft; panScrollY = pages.scrollTop;
        try { pages.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone; pointerup/cancel below still end the pan */ }
      });
      pages.addEventListener("pointermove", function (e) {
        if (!panning) return;
        pages.scrollLeft = panScrollX - (e.clientX - panStartX);
        pages.scrollTop = panScrollY - (e.clientY - panStartY);
      });
      var endPan = function () { panning = false; };
      pages.addEventListener("pointerup", endPan);
      pages.addEventListener("pointercancel", endPan);
    }

    dlg.addEventListener("keydown", function (e) {
      if (!pages || pages.hidden) return;   // only page/zoom while the document view is open
      if (e.key === "ArrowRight") { e.preventDefault(); stepPage(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); stepPage(-1); }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom(zoom + ZOOM_STEP); }
      if (e.key === "-" || e.key === "_") { e.preventDefault(); setZoom(zoom - ZOOM_STEP); }
      if (e.key === "0") { e.preventDefault(); zoomReset(); }
    });

    closeBtn.addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });

    dlg.addEventListener("close", function () {
      /* drop the src so a closed viewer stops loading or playing */
      frame.removeAttribute("src");
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();          // abandons the buffered stream, not just paused
        video.hidden = true;
      }
      if (pages) pages.hidden = true;
      if (zoomBox) zoomBox.hidden = true;
      if (pagePrev) pagePrev.hidden = true;
      if (pageNext) pageNext.hidden = true;
      if (pageImg) { pageImg.removeAttribute("src"); pageImg.removeAttribute("alt"); }
      if (countEl) countEl.textContent = "";
      pageTotal = 0;
      zoomReset();
      root.classList.remove("lb-open");
      if (lenis) lenis.start();
      if (opener) opener.focus();
      opener = null;
    });
  })();

  /* ---------------------------------------------------------------------
     Practice filter

     The chip row carries `hidden` in the markup and is revealed here, so a
     page without JavaScript shows every card rather than offering a control
     that cannot do anything.
     --------------------------------------------------------------------- */
  (function projFilter() {
    var wrap = document.getElementById("projFilter");
    var grid = document.getElementById("projGrid");
    if (!wrap || !grid) return;

    var cards = $$(".proj-card", grid);
    var chips = $$(".filter-chip", wrap);
    var countEl = document.getElementById("projCount");
    if (!cards.length || !chips.length) return;

    /* Nothing to filter with a single practice: offering "All work / Bates
       Smart" over one group is noise. The row comes back on its own once a
       second group exists. */
    var groups = {};
    cards.forEach(function (c) { groups[c.getAttribute("data-group")] = 1; });
    if (Object.keys(groups).length < 2) return;

    wrap.hidden = false;

    function apply(key, fromClick) {
      var shown = [];
      cards.forEach(function (card) {
        var match = key === "all" || card.getAttribute("data-group") === key;
        card.hidden = !match;
        if (match) shown.push(card);
      });

      chips.forEach(function (chip) {
        chip.setAttribute("aria-pressed",
          String(chip.getAttribute("data-filter") === key));
      });

      if (countEl) {
        countEl.textContent = shown.length +
          (shown.length === 1 ? " project" : " projects");
      }

      /* The grid entrance tween sets opacity 0 on cards that have not been
         scrolled to yet. Once the visitor is driving the filter, show what
         they asked for rather than leaving it invisible below the fold. */
      if (fromClick && animate) {
        gsap.set(shown, { opacity: 1, y: 0 });
      }
      if (fromClick && hasST) ScrollTrigger.refresh();
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        apply(chip.getAttribute("data-filter"), true);
      });
    });

    apply("all", false);
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

    var roleEl = document.getElementById("lbRole");
    var factsEl = document.getElementById("lbFacts");

    /* Same defensive posture as the gallery: a malformed attribute yields an
       empty fact list rather than taking the lightbox down, and every value
       goes in through textContent so it can never become markup. */
    function renderFacts(raw) {
      if (!factsEl) return;
      factsEl.textContent = "";
      if (!raw) return;
      var rows;
      try {
        rows = JSON.parse(raw);
      } catch (err) {
        if (window.console) console.warn("Lightbox: facts JSON is not parseable.", err);
        return;
      }
      if (!Array.isArray(rows)) return;
      rows.forEach(function (row) {
        if (!Array.isArray(row) || row.length < 2) return;
        if (typeof row[0] !== "string" || typeof row[1] !== "string") return;
        var dt = document.createElement("dt");
        dt.textContent = row[0];
        var dd = document.createElement("dd");
        dd.textContent = row[1];
        factsEl.appendChild(dt);
        factsEl.appendChild(dd);
      });
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
      /* This card shows its portfolio pages in the viewer instead. Leave it
         alone, or both dialogs would open on the same click. */
      if (card.getAttribute("data-viewer-pages")) return;

      trigger.addEventListener("click", function () {
        var items = parseGallery(card.getAttribute("data-gallery"));
        if (!items.length) return;   // nothing to show, leave the page as it is

        gallery = items;
        index = 0;
        opener = trigger;
        baseDesc = card.getAttribute("data-desc") || "";
        titleEl.textContent = card.getAttribute("data-title") || "";
        if (metaEl) metaEl.textContent = card.getAttribute("data-meta") || "";
        if (roleEl) roleEl.textContent = card.getAttribute("data-role") || "";
        renderFacts(card.getAttribute("data-facts"));

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
     Toolkit pills

     Each column is its own small physics world, so a released pill stays
     inside its own category rather than tumbling into a single pile. Pills
     hold their laid-out positions until the panel is clicked, then drop.

     Matter.js is optional in exactly the way gsap and Lenis are: if it is not
     there, or motion is reduced, the pills stay in their normal flex layout
     and the Toolkit reads as a plain list of tools.
     --------------------------------------------------------------------- */
  (function toolkitPills() {
    var grid = document.getElementById("toolGrid");
    if (!grid || reduce) return;
    if (typeof window.Matter === "undefined") return;

    var M = window.Matter;
    var columns = [];

    $$(".tool-pills", grid).forEach(function (list) {
      var pills = $$(".tool-pill", list);
      if (!pills.length) return;

      var w = list.clientWidth;
      var h = list.clientHeight;
      if (!w || !h) return;

      /* Capture where the browser already laid each pill out, so the drop
         starts from exactly what the visitor is looking at. */
      var listBox = list.getBoundingClientRect();
      var seed = pills.map(function (p) {
        var r = p.getBoundingClientRect();
        return {
          el: p,
          x: r.left - listBox.left,
          y: r.top - listBox.top,
          w: r.width,
          h: r.height
        };
      });

      var engine = M.Engine.create();
      engine.gravity.y = 1;

      var WALL = 200;   // thick walls, so nothing tunnels out at speed
      var walls = [
        M.Bodies.rectangle(w / 2, h + WALL / 2, w + WALL * 2, WALL, { isStatic: true }),
        M.Bodies.rectangle(-WALL / 2, h / 2, WALL, h * 3, { isStatic: true }),
        M.Bodies.rectangle(w + WALL / 2, h / 2, WALL, h * 3, { isStatic: true })
      ];
      M.Composite.add(engine.world, walls);

      var bodies = seed.map(function (s) {
        var body = M.Bodies.rectangle(
          s.x + s.w / 2, s.y + s.h / 2, s.w, s.h,
          { chamfer: { radius: Math.min(s.h / 2, 18) },
            restitution: 0.35, friction: 0.4, frictionAir: 0.02 });
        M.Body.setStatic(body, true);          // held until release
        /* homeX/homeY are the laid-out centre, so Reset can put each pill
           back exactly where it started. */
        body.plugin = {
          el: s.el, w: s.w, h: s.h,
          homeX: s.x + s.w / 2, homeY: s.y + s.h / 2
        };
        return body;
      });
      M.Composite.add(engine.world, bodies);

      /* Pills become absolutely positioned only now, at the coordinates they
         already occupy, so switching over does not visibly move anything. */
      list.classList.add("is-live");
      list.style.height = h + "px";
      seed.forEach(function (s) {
        s.el.style.width = s.w + "px";
        s.el.style.transform =
          "translate(" + s.x + "px," + s.y + "px)";
      });

      columns.push({ list: list, engine: engine, bodies: bodies, w: w, h: h });
    });

    if (!columns.length) return;
    root.classList.add("tools-ready");

    var running = false;
    var released = false;
    var raf = null;
    var inView = true;

    function paint(col) {
      col.bodies.forEach(function (b) {
        var p = b.plugin;
        p.el.style.transform =
          "translate(" + (b.position.x - p.w / 2).toFixed(2) + "px," +
          (b.position.y - p.h / 2).toFixed(2) + "px) " +
          "rotate(" + b.angle.toFixed(3) + "rad)";
      });
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      columns.forEach(function (col) {
        M.Engine.update(col.engine, 1000 / 60);
        paint(col);
      });
    }

    function sync() {
      var should = running && inView && !document.hidden;
      if (should && raf === null) raf = requestAnimationFrame(frame);
      else if (!should && raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }

    function release() {
      if (released) return;
      released = true;
      running = true;
      root.classList.add("tools-dropped");
      columns.forEach(function (col) {
        col.bodies.forEach(function (b) {
          M.Body.setStatic(b, false);
          /* a touch of spin so they do not fall dead straight */
          M.Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.12);
        });
      });
      sync();
    }

    grid.addEventListener("click", release);

    /* Reset: freeze every pill and set it back to its laid-out home, then let
       a fresh click drop them again. The button lives outside #toolGrid, so
       clicking it never counts as a drop. */
    function reset() {
      if (!released) return;
      columns.forEach(function (col) {
        col.bodies.forEach(function (b) {
          M.Body.setStatic(b, true);
          M.Body.setPosition(b, { x: b.plugin.homeX, y: b.plugin.homeY });
          M.Body.setAngle(b, 0);
          M.Body.setVelocity(b, { x: 0, y: 0 });
          M.Body.setAngularVelocity(b, 0);
        });
        paint(col);
      });
      released = false;
      running = false;
      root.classList.remove("tools-dropped");
      sync();
    }

    var resetBtn = document.getElementById("toolReset");
    if (resetBtn) resetBtn.addEventListener("click", reset);

    /* Dragging, desktop pointers only: on touch this would fight the scroll. */
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      columns.forEach(function (col) {
        var mouse = M.Mouse.create(col.list);
        var mc = M.MouseConstraint.create(col.engine, {
          mouse: mouse,
          constraint: { stiffness: 0.2, render: { visible: false } }
        });
        M.Composite.add(col.engine.world, mc);
        /* let the page keep scrolling over the pills */
        mouse.element.removeEventListener("wheel", mouse.mousewheel);
        M.Events.on(mc, "startdrag", function (e) {
          if (e.body && e.body.plugin) e.body.plugin.el.classList.add("is-held");
        });
        M.Events.on(mc, "enddrag", function (e) {
          if (e.body && e.body.plugin) e.body.plugin.el.classList.remove("is-held");
        });
      });
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        sync();
      }, { threshold: 0 }).observe(grid);
    }
    document.addEventListener("visibilitychange", sync);
  })();

  /* ---------------------------------------------------------------------
     Contact: copy email to clipboard

     The button carries the address in data-email, so the markup stays the
     single source of truth. On success the label reads "Copied" and the
     glyph flips to a tick for a moment, then reverts. execCommand is the
     fallback for browsers without the async Clipboard API.
     --------------------------------------------------------------------- */
  (function copyEmail() {
    var btn = document.getElementById("copyEmail");
    if (!btn) return;
    var label = btn.querySelector(".btn-label");
    var email = btn.getAttribute("data-email") || "";
    var idle = btn.getAttribute("data-label") || "Email me";
    var timer = null;

    function setLabel(text) {
      if (!label) return;
      label.textContent = text;
      label.setAttribute("data-text", text);   /* keep the roll copy in sync */
    }

    function confirmed() {
      setLabel("Copied");
      btn.classList.add("is-copied");
      clearTimeout(timer);
      timer = setTimeout(function () {
        setLabel(idle);
        btn.classList.remove("is-copied");
      }, 1600);
    }

    function legacyCopy() {
      var ta = document.createElement("textarea");
      ta.value = email;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* nothing else to try */ }
      document.body.removeChild(ta);
      confirmed();
    }

    btn.addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(confirmed, legacyCopy);
      } else {
        legacyCopy();
      }
    });
  })();

  /* ---------------------------------------------------------------------
     Magnetic buttons: desktop pointer only, decorative
     --------------------------------------------------------------------- */
  if (animate && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    /* Sweep pills own their hover motion (fill plus label roll), so keep them
       out of the magnetic drift to match the educabellos CTA feel. */
    $$(".btn:not(.btn--sweep)").forEach(function (btn) {
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

  /* ---------------------------------------------------------------------
     Custom cursor: fine pointer only, motion allowed only

     A dot trails the pointer and swells over interactive targets, using
     mix-blend-mode so it reads on any background. Touch and coarse pointers,
     and anyone with prefers-reduced-motion, keep the native cursor. Purely
     decorative, so the node is created in script and never exists without it.
     GSAP smooths the follow when present; without it the dot tracks 1:1.
     --------------------------------------------------------------------- */
  if (!reduce && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    (function customCursor() {
      var dot = document.createElement("div");
      dot.className = "cursor-dot";
      dot.setAttribute("aria-hidden", "true");
      document.body.appendChild(dot);
      root.classList.add("has-cursor");

      var moveX, moveY;
      if (hasGSAP) {
        gsap.set(dot, { xPercent: -50, yPercent: -50 });
        moveX = gsap.quickTo(dot, "x", { duration: 0.18, ease: "power3.out" });
        moveY = gsap.quickTo(dot, "y", { duration: 0.18, ease: "power3.out" });
      }

      var lastX = 0, lastY = 0, shown = false;
      var place = rafThrottle(function () {
        if (hasGSAP) { moveX(lastX); moveY(lastY); }
        else { dot.style.transform = "translate(" + lastX + "px," + lastY + "px) translate(-50%,-50%)"; }
      });

      window.addEventListener("pointermove", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;   /* ignore pen/touch */
        lastX = e.clientX;
        lastY = e.clientY;
        if (!shown) { shown = true; dot.classList.add("is-visible"); }
        place();
      }, { passive: true });

      /* hide while the pointer is off the document, show again on return */
      document.addEventListener("mouseleave", function () {
        shown = false;
        dot.classList.remove("is-visible");
      });
      document.addEventListener("mouseenter", function () {
        shown = true;
        dot.classList.add("is-visible");
      });

      /* swell over interactive targets via delegation, so nodes added later
         (or swapped icons) are covered without re-binding */
      var interactive = "a, button, .btn, [role='button'], summary";
      document.addEventListener("pointerover", function (e) {
        if (e.target.closest && e.target.closest(interactive)) dot.classList.add("is-active");
      });
      document.addEventListener("pointerout", function (e) {
        if (!e.target.closest || !e.target.closest(interactive)) return;
        var to = e.relatedTarget;
        if (!to || !(to.closest && to.closest(interactive))) dot.classList.remove("is-active");
      });
    })();
  }
})();
