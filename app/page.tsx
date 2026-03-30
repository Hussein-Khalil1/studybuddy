"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import styles from "./landing.module.css";


export default function Home() {
  const phoneRef = useRef<HTMLDivElement>(null);
  const phoneGlowRef = useRef<HTMLDivElement>(null);
  const fpLeftRef = useRef<HTMLDivElement>(null);
  const fpTagRef = useRef<HTMLDivElement>(null);
  const fpTitleRef = useRef<HTMLDivElement>(null);
  const fpBodyRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const screenRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── PHONE STAGE CONTROLLER ──
  useEffect(() => {
    const scene  = sceneRef.current;
    const sticky = stickyRef.current;
    if (!scene || !sticky) return;

    const STAGES = [
      { tag: "Course Matching", title: "Find your people,\ninstantly.",   body: "Pick your courses and we'll auto-match you into a group of 4–5 students on day one. No awkward intros required.", rotateY: -8, rotateX:  3, scale: 0.88 },
      { tag: "Group Chats",     title: "Your crew,\nall in one place.",    body: "Chat with your study group, share notes, and plan sessions — all within the platform.",                              rotateY:  0, rotateX:  0, scale: 1    },
      { tag: "Progress Logs",   title: "Stay on track,\ntogether.",        body: "Log your assignment progress publicly so your group always knows where everyone stands.",                           rotateY:  5, rotateX: -2, scale: 1    },
      { tag: "Leaderboards",    title: "Compete.\nClimb. Win.",            body: "Earn points for every study session, milestone, and group activity. See how your crew stacks up.",                  rotateY: -4, rotateX:  2, scale: 1.02 },
      { tag: "Focus Timers",    title: "Focus mode\nactivated.",           body: "Run live Pomodoro sessions with your group. See everyone's study time in real-time.",                               rotateY:  0, rotateX:  0, scale: 1    },
    ];

    let stage = 0;
    let locked = false;
    let sectionTop = 0;   // scene.offsetTop captured at lock time
    let accumulated = 0;

    // ── show: apply one stage's visuals ──────────────────────────────────────
    const show = (idx: number) => {
      stage = idx;
      const s = STAGES[idx];

      const phone = phoneRef.current;
      if (phone)
        phone.style.transform = `perspective(1000px) rotateY(${s.rotateY}deg) rotateX(${s.rotateX}deg) scale(${s.scale})`;

      screenRefs.current.forEach((el, i) => {
        if (el) el.style.opacity = i === idx ? "1" : "0";
      });

      const fpLeft  = fpLeftRef.current;
      const fpTag   = fpTagRef.current;
      const fpTitle = fpTitleRef.current;
      const fpBody  = fpBodyRef.current;
      if (fpLeft && fpTag && fpTitle && fpBody) {
        fpTag.textContent  = s.tag;
        fpTitle.innerHTML  = s.title.replace("\n", "<br/>");
        fpBody.textContent = s.body;
        fpLeft.style.opacity   = "1";
        fpLeft.style.transform = "translateY(-50%)";
      }

      if (phoneGlowRef.current)
        phoneGlowRef.current.style.boxShadow = idx > 0
          ? "0 0 80px 20px rgba(194,112,138,0.25)"
          : "0 0 80px 20px rgba(194,112,138,0)";
    };

    // ── lock: freeze page and enter immersive mode ───────────────────────────
    const lock = () => {
      if (locked) return;
      locked = true;
      accumulated = 0;
      sectionTop = scene.offsetTop;   // capture BEFORE body position changes

      // Snap to section top — cancels any momentum overshoot
      window.scrollTo(0, sectionTop);

      // Freeze body (position:fixed trick keeps visual position identical)
      const sbw = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = sbw > 0 ? `${sbw}px` : "";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top      = `-${sectionTop}px`;
      document.body.style.width    = "100%";

      show(0);
    };

    // ── unlock: restore page scroll ──────────────────────────────────────────
    const unlock = (goDown: boolean) => {
      locked      = false;
      accumulated = 0;

      document.body.style.overflow     = "";
      document.body.style.position     = "";
      document.body.style.top          = "";
      document.body.style.width        = "";
      document.body.style.paddingRight = "";

      window.scrollTo(0, goDown
        ? sectionTop + window.innerHeight + 1
        : Math.max(0, sectionTop - 1));

      if (!goDown) {
        const fpLeft = fpLeftRef.current;
        if (fpLeft) {
          fpLeft.style.opacity   = "0";
          fpLeft.style.transform = "translateY(calc(-50% + 20px))";
        }
      }
    };

    // ── scroll: the ONLY reliable way to catch fast-scrollers ────────────────
    // The `scroll` event fires on every paint frame during any scroll (including
    // momentum / programmatic). A `wheel` listener alone can be skipped if the
    // user flings fast enough that the section passes in a single frame.
    const onScroll = () => {
      if (locked) return;
      const rect = scene.getBoundingClientRect();
      // Engage as soon as the section top hits the viewport top
      if (rect.top <= 0 && rect.bottom > 0) lock();
    };

    // ── wheel: advance stages while locked ───────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      if (!locked) return;
      e.preventDefault();

      accumulated += e.deltaY;
      if (Math.abs(accumulated) < 30) return; // absorb trackpad micro-events

      const dir = accumulated > 0 ? 1 : -1;
      accumulated = 0;

      const next = stage + dir;
      if (next < 0)                   unlock(false);
      else if (next >= STAGES.length) unlock(true);
      else                            show(next);
    };

    // ── keyboard: arrow / page keys also advance stages ──────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (!locked) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        const next = stage + 1;
        if (next >= STAGES.length) unlock(true); else show(next);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        const next = stage - 1;
        if (next < 0) unlock(false); else show(next);
      }
    };

    window.addEventListener("scroll",  onScroll,  { passive: true });
    window.addEventListener("wheel",   onWheel,   { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("scroll",  onScroll);
      window.removeEventListener("wheel",   onWheel);
      window.removeEventListener("keydown", onKeyDown);
      if (locked) {
        document.body.style.overflow     = "";
        document.body.style.position     = "";
        document.body.style.top          = "";
        document.body.style.width        = "";
        document.body.style.paddingRight = "";
      }
    };
  }, []);

  // ── PARTICLES ──
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;

    for (let i = 0; i < 20; i++) {
      const p = document.createElement("div");
      p.className = styles.particle;
      const size = Math.random() * 4 + 2;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDuration = `${Math.random() * 12 + 8}s`;
      p.style.animationDelay = `${Math.random() * 8}s`;
      p.style.opacity = "0";
      container.appendChild(p);
    }

    return () => {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  // ── SCROLL REVEAL ──
  // Uses data-reveal attribute instead of CSS module class to avoid hashed
  // class name issues with querySelectorAll.
  useEffect(() => {
    const reveals = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const revealEl = (el: HTMLElement) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) revealEl(e.target as HTMLElement);
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);


  // ── COUNTDOWN TIMER ──
  useEffect(() => {
    let timerSec = 24 * 60 + 38;
    timerRef.current = setInterval(() => {
      if (timerSec > 0) timerSec--;
      const m = Math.floor(timerSec / 60);
      const s = timerSec % 60;
      const el = document.getElementById("timer-display");
      if (el) {
        el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className={styles.root}>
      {/* NAV */}
      <nav className={styles.nav}>
        <a href="#" className={styles.logo}>
          <Image
            src="/logo.png"
            alt="StudyBuddy"
            width={120}
            height={30}
            style={{ height: "30px", width: "auto", display: "block" }}
            priority={true}
          />
        </a>

        <ul className={styles.navList}>
          <li><a href="#features">Features</a></li>
          <li><a href="#how">How it works</a></li>
          <li><a href="#leaderboard">Compete</a></li>
        </ul>

        <div className={styles.navActions}>
          <a href="/auth" className={styles.navLogin}>Log in</a>
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBg}></div>
        <div className={styles.heroBadge}>
          <span className={styles.badgeDot}></span>
          Now open for UofT students 
        </div>
        <h1 className={styles.heroH1}>
          Study smarter,
          <br />
          <span className={styles.gradientWord}>together.</span>
        </h1>
        <p className={styles.heroP}>
          Choose you study groups, peer accountability, and friendly
          competition — built for UofT students who want to do more than just
          get by.
        </p>
        <div className={styles.heroBtns}>
          <a href="/auth?tab=signup" className={styles.btnPrimary}>Sign Up</a>
          <a href="#features" className={styles.btnSecondary}>Learn More</a>
        </div>
      </section>

      {/* SCROLL SCENE */}
      <section
        className={styles.scrollScene}
        id="scroll-scene"
        ref={sceneRef}
      >
        <div className={styles.scrollSticky} id="scroll-sticky" ref={stickyRef}>
          <div className={styles.sceneParticles} ref={particlesRef}></div>

          <div className={styles.sceneContent}>
            {/* LEFT PANEL — inline styles so JS can override them directly */}
            <div
              className={`${styles.floatPanel} ${styles.fpLeft}`}
              ref={fpLeftRef}
              style={{
                opacity: 0,
                transform: "translateY(calc(-50% + 20px))",
                transition: "opacity 0.7s ease, transform 0.7s ease",
              }}
            >
              <div className={styles.fpTag} ref={fpTagRef}>
                Course Matching
              </div>
              <div className={styles.fpTitle} ref={fpTitleRef}>
                Find your people,
                <br />
                instantly.
              </div>
              <div className={styles.fpBody} ref={fpBodyRef}>
                Pick your courses and we&apos;ll auto-match you into a group of
                4–5 students on day one. No awkward intros required.
              </div>
            </div>

            {/* PHONE */}
            <div className={styles.phoneWrap}>
              <div className={styles.phoneGlow} ref={phoneGlowRef}></div>
              <div className={styles.phone} ref={phoneRef}>
                <div className={styles.phoneNotch}></div>
                <div className={styles.phoneScreen}>

                  {/* Screen 0 — starts visible; JS takes over opacity after mount */}
                  <div
                    className={styles.pscreen}
                    style={{ opacity: 1 }}
                    ref={(el) => { screenRefs.current[0] = el; }}
                  >
                    <div className={styles.psHeader}>Welcome, Aisha 👋</div>
                    <div className={styles.psSub}>
                      Select your courses this semester
                    </div>
                    <div className={`${styles.courseChip} ${styles.courseChipSelected}`}>
                      <span className={styles.chipDot}></span> CSC148 · Intro to CS
                    </div>
                    <div className={`${styles.courseChip} ${styles.courseChipSelected}`}>
                      <span className={`${styles.chipDot} ${styles.chipDotG}`}></span>{" "}
                      MAT137 · Calculus
                    </div>
                    <div className={styles.courseChip}>
                      <span className={`${styles.chipDot} ${styles.chipDotP}`}></span>{" "}
                      ECO101 · Microeconomics
                    </div>
                    <div className={styles.courseChip}>
                      <span className={styles.chipDot}></span> ENG110 · Writing
                    </div>
                    <div className={styles.courseMatchBtn}>
                      Match me with a group →
                    </div>
                  </div>

                  {/* Screen 1 */}
                  <div
                    className={styles.pscreen}
                    ref={(el) => { screenRefs.current[1] = el; }}
                  >
                    <div className={styles.psHeader} style={{ fontSize: "14px" }}>
                      CSC148 Study Crew 💻
                    </div>
                    <div className={styles.psSub}>4 members · online</div>
                    <div className={styles.chatFlex}>
                      <div>
                        <div className={styles.cbName}>Jordan</div>
                        <div className={`${styles.chatBubble} ${styles.cbThem}`}>
                          Anyone understand Big O from lecture 6? 😅
                        </div>
                      </div>
                      <div>
                        <div className={styles.cbName}>Priya</div>
                        <div className={`${styles.chatBubble} ${styles.cbThem}`}>
                          yes!! let&apos;s do a call tonight
                        </div>
                      </div>
                      <div>
                        <div className={`${styles.chatBubble} ${styles.cbMe}`}>
                          I&apos;m in, 8pm?
                        </div>
                      </div>
                      <div>
                        <div className={styles.cbName}>Marcus</div>
                        <div className={`${styles.chatBubble} ${styles.cbThem}`}>
                          Works for me 👍 I&apos;ll share my notes
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Screen 2 */}
                  <div
                    className={styles.pscreen}
                    ref={(el) => { screenRefs.current[2] = el; }}
                  >
                    <div className={styles.psHeader} style={{ fontSize: "14px" }}>
                      Assignment Tracker
                    </div>
                    <div className={styles.psSub}>A1 · Due Nov 18</div>
                    <div className={styles.progItem}>
                      <div className={styles.progRow}>
                        <div>
                          <div className={styles.progLabel}>Aisha</div>
                          <div style={{ color: "var(--text)", fontSize: "12px", fontWeight: 500 }}>
                            Implementing BST
                          </div>
                        </div>
                        <div style={{ color: "var(--accent3)", fontWeight: 600, fontSize: "13px" }}>75%</div>
                      </div>
                      <div className={styles.progBar}>
                        <div className={styles.progFill} style={{ width: "75%" }}></div>
                      </div>
                    </div>
                    <div className={styles.progItem}>
                      <div className={styles.progRow}>
                        <div>
                          <div className={styles.progLabel}>Jordan</div>
                          <div style={{ color: "var(--text)", fontSize: "12px", fontWeight: 500 }}>
                            Test cases
                          </div>
                        </div>
                        <div style={{ color: "var(--accent)", fontWeight: 600, fontSize: "13px" }}>50%</div>
                      </div>
                      <div className={styles.progBar}>
                        <div className={styles.progFill} style={{ width: "50%" }}></div>
                      </div>
                    </div>
                    <div className={styles.progItem}>
                      <div className={styles.progRow}>
                        <div>
                          <div className={styles.progLabel}>Priya</div>
                          <div style={{ color: "var(--text)", fontSize: "12px", fontWeight: 500 }}>
                            Documentation
                          </div>
                        </div>
                        <div style={{ color: "var(--accent2)", fontWeight: 600, fontSize: "13px" }}>90%</div>
                      </div>
                      <div className={styles.progBar}>
                        <div
                          className={styles.progFill}
                          style={{
                            width: "90%",
                            background: "linear-gradient(90deg,var(--accent2),var(--accent))",
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Screen 3 */}
                  <div
                    className={styles.pscreen}
                    ref={(el) => { screenRefs.current[3] = el; }}
                  >
                    <div className={styles.psHeader} style={{ fontSize: "14px" }}>
                      🏆 Weekly Rankings
                    </div>
                    <div className={styles.psSub}>CSC148 · Week 9</div>
                    <div className={styles.lbList}>
                      <div className={styles.lbRow}>
                        <div className={`${styles.lbRank} ${styles.lbRankGold}`}>1</div>
                        <div className={styles.lbName}>The Recursors</div>
                        <div className={styles.lbPts}>2,840 pts</div>
                      </div>
                      <div className={`${styles.lbRow} ${styles.lbRowHighlight}`}>
                        <div className={`${styles.lbRank} ${styles.lbRankSilver}`}>2</div>
                        <div className={styles.lbName}>Study Crew ⬅ you</div>
                        <div className={styles.lbPts}>2,610 pts</div>
                      </div>
                      <div className={styles.lbRow}>
                        <div className={styles.lbRank}>3</div>
                        <div className={styles.lbName}>The Debuggers</div>
                        <div className={styles.lbPts}>2,390 pts</div>
                      </div>
                      <div className={styles.lbRow}>
                        <div className={styles.lbRank}>4</div>
                        <div className={styles.lbName}>Branch &amp; Bound</div>
                        <div className={styles.lbPts}>1,950 pts</div>
                      </div>
                    </div>
                  </div>

                  {/* Screen 4 */}
                  <div
                    className={styles.pscreen}
                    ref={(el) => { screenRefs.current[4] = el; }}
                  >
                    <div
                      className={styles.psHeader}
                      style={{ fontSize: "14px", textAlign: "center" }}
                    >
                      Focus Session 🔥
                    </div>
                    <div className={styles.psSub} style={{ textAlign: "center" }}>
                      MAT137 · Pomodoro
                    </div>
                    <div className={styles.timerBig} id="timer-display">
                      24:38
                    </div>
                    <div className={styles.timerLabel}>Session in progress</div>
                    <div className={styles.timerUsers}>
                      <div className={styles.tu}>
                        <div className={styles.tuName}>You</div>
                        <div className={styles.tuTime}>1h 12m</div>
                      </div>
                      <div className={styles.tu}>
                        <div className={styles.tuName}>Jordan</div>
                        <div className={styles.tuTime}>0h 58m</div>
                      </div>
                      <div className={styles.tu}>
                        <div className={styles.tuName}>Priya</div>
                        <div className={styles.tuTime}>1h 24m</div>
                      </div>
                    </div>
                    <div className={styles.timerNext}>
                      <span className={styles.timerNextLabel}>Next deadline</span>
                      <span className={styles.timerNextVal}>A2 in 3 days</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* RIGHT PANEL — placeholder to balance layout */}
            <div
              className={styles.floatPanel}
              style={{ opacity: 0, right: 0, top: "50%", transform: "translateY(-50%)" }}
            ></div>
          </div>

        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features} id="features">
        <div className={styles.reveal} data-reveal="true">
          <div className={styles.sectionLabel}>Everything you need</div>
          <h2 className={styles.sectionTitle}>
            Built for how
            <br />
            students actually work.
          </h2>
          <p className={styles.sectionBody}>
            Every tool designed around the way UofT students study, collaborate,
            and compete.
          </p>
        </div>

        <div className={styles.featGrid}>
          <div
            className={`${styles.featCard} ${styles.featCardLarge} ${styles.reveal} ${styles.revealDelay1}`}
            data-reveal="true"
            style={{ "--card-glow": "rgba(108,142,255,0.12)" } as React.CSSProperties}
          >
            <div className={styles.featIcon} style={{ background: "rgba(108,142,255,0.12)" }}>🤝</div>
            <h3>Auto-Matched Groups</h3>
            <p>
              Share your courses, get matched with 4–5 peers automatically. Leave,
              join, or invite friends — the choice is yours after initial matching.
            </p>
          </div>
          <div
            className={`${styles.featCard} ${styles.reveal} ${styles.revealDelay2}`}
            data-reveal="true"
            style={{ "--card-glow": "rgba(52,211,153,0.1)" } as React.CSSProperties}
          >
            <div className={styles.featIcon} style={{ background: "rgba(52,211,153,0.12)" }}>📅</div>
            <h3>Quercus + Calendar Sync</h3>
            <p>Deadlines from your course automatically surface in the app — no manual entry.</p>
          </div>
          <div
            className={`${styles.featCard} ${styles.reveal} ${styles.revealDelay1}`}
            data-reveal="true"
            style={{ "--card-glow": "rgba(167,139,250,0.1)" } as React.CSSProperties}
          >
            <div className={styles.featIcon} style={{ background: "rgba(167,139,250,0.12)" }}>📊</div>
            <h3>Progress Logs</h3>
            <p>
              Let your group know where you&apos;re at — publicly log your
              assignment progress and stay accountable.
            </p>
          </div>
          <div
            className={`${styles.featCard} ${styles.reveal} ${styles.revealDelay2}`}
            data-reveal="true"
            style={{ "--card-glow": "rgba(245,200,66,0.1)" } as React.CSSProperties}
          >
            <div className={styles.featIcon} style={{ background: "rgba(245,200,66,0.1)" }}>🏆</div>
            <h3>Group Leaderboard</h3>
            <p>
              Earn points for study sessions, completed milestones, and group
              participation. See where your crew ranks each week.
            </p>
          </div>
          <div
            className={`${styles.featCard} ${styles.reveal} ${styles.revealDelay3}`}
            data-reveal="true"
            style={{ "--card-glow": "rgba(108,142,255,0.08)" } as React.CSSProperties}
          >
            <div className={styles.featIcon} style={{ background: "rgba(108,142,255,0.08)" }}>⏱</div>
            <h3>Study Timers</h3>
            <p>
              Run live focus sessions with your group. See each other&apos;s time
              in real-time — friendly competition baked in.
            </p>
          </div>
          <div
            className={`${styles.featCard} ${styles.reveal} ${styles.revealDelay1}`}
            data-reveal="true"
            style={{ "--card-glow": "rgba(52,211,153,0.08)" } as React.CSSProperties}
          >
            <div className={styles.featIcon} style={{ background: "rgba(52,211,153,0.08)" }}>🎥</div>
            <h3>Virtual Study Rooms</h3>
            <p>One-click group calls. No Zoom link hunting, no calendar invites. Just open and go.</p>
          </div>
          <div
            className={`${styles.featCard} ${styles.reveal} ${styles.revealDelay2}`}
            data-reveal="true"
            style={{ "--card-glow": "rgba(167,139,250,0.08)" } as React.CSSProperties}
          >
            <div className={styles.featIcon} style={{ background: "rgba(167,139,250,0.08)" }}>🚨</div>
            <h3>Safe Space</h3>
            <p>
              Built-in report and moderation tools so every group stays positive,
              respectful, and focused.
            </p>
          </div>
          <div
            className={`${styles.featCard} ${styles.reveal} ${styles.revealDelay3}`}
            data-reveal="true"
            style={{ "--card-glow": "rgba(108,142,255,0.08)" } as React.CSSProperties}
          >
            <div className={styles.featIcon} style={{ background: "rgba(108,142,255,0.08)" }}>🔔</div>
            <h3>Smart Reminders</h3>
            <p>
              Course-aware deadline reminders pushed to you and your group — never
              miss a submission again.
            </p>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div
        className={`${styles.stats} ${styles.reveal}`}
        data-reveal="true"
      >
        <div>
          <div className={styles.statNum}>4–5</div>
          <div className={styles.statLabel}>Students per group</div>
        </div>
        <div>
          <div className={styles.statNum}>∞</div>
          <div className={styles.statLabel}>Study sessions</div>
        </div>
        <div>
          <div className={styles.statNum}>UofT</div>
          <div className={styles.statLabel}>Exclusive platform</div>
        </div>
        <div>
          <div className={styles.statNum}>0</div>
          <div className={styles.statLabel}>Awkward intros</div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className={styles.hiw} id="how">
        <div className={styles.reveal} data-reveal="true">
          <div className={styles.sectionLabel}>Get started in minutes</div>
          <h2 className={styles.sectionTitle}>How it works.</h2>
        </div>

        <div className={styles.steps}>
          <div
            className={`${styles.step} ${styles.reveal} ${styles.revealDelay1}`}
            data-reveal="true"
          >
            <div className={styles.stepNum}>01</div>
            <h4>Sign up with UofT email</h4>
            <p>Verify your student status and set up your profile in under 2 minutes.</p>
          </div>
          <div
            className={`${styles.step} ${styles.reveal} ${styles.revealDelay2}`}
            data-reveal="true"
          >
            <div className={styles.stepNum}>02</div>
            <h4>Choose your courses</h4>
            <p>Select from all active UofT courses. Your enrollment, your groups.</p>
          </div>
          <div
            className={`${styles.step} ${styles.reveal} ${styles.revealDelay3}`}
            data-reveal="true"
          >
            <div className={styles.stepNum}>03</div>
            <h4>Get auto-matched</h4>
            <p>We place you into a group with peers in the same courses — instantly.</p>
          </div>
          <div
            className={`${styles.step} ${styles.reveal} ${styles.revealDelay3}`}
            data-reveal="true"
          >
            <div className={styles.stepNum}>04</div>
            <h4>Start studying</h4>
            <p>Chat, call, track deadlines, compete, and do more — together.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection} id="cta">
        <h2>
          Your study group
          <br />
          is waiting.
        </h2>
        <p>Be among the first UofT students to access StudyBuddy when we launch.</p>
        <div className={styles.ctaBtnWrap}>
          <a href="/auth?tab=signup" className={`${styles.btnPrimary} ${styles.ctaBtn}`}>
            Sign Up →
          </a>
        </div>
        <div className={styles.uoftBadge}>
          <div className={styles.uoftLogo}>U</div>
          Made for University of Toronto students
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <a href="#" className={styles.logo}>
          <Image
            src="/logo.png"
            alt="StudyBuddy"
            width={96}
            height={24}
            style={{ height: "24px", width: "auto", display: "block" }}
          />
        </a>
        <p className={styles.footerCopy}>
          © 2025 StudyBuddy. Built for UofT. All rights reserved.
        </p>
        <div className={styles.footerLinks}>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
}
