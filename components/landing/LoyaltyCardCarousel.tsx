"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

export interface CarouselSlide {
  slug: string;
  /** The trade, capitalised: "Barberías". */
  label: string;
  /** "Sellos" or "Cashback" — the two mechanics, visible side by side. */
  mechanic: string;
  /** Rendered on the server: the real LoyaltyCard for this trade. */
  card: ReactNode;
}

/** How many copies of the catalogue are laid end to end. Three is the minimum
 *  that lets the reader scroll a full catalogue in either direction before the
 *  belt is silently re-centred. */
const COPIES = 3;
const AUTOPLAY_MS = 3200;

/**
 * The loyalty card, once per trade, as an endlessly scrolling row.
 *
 * The cards are NOT built here — they arrive already rendered from the server
 * (`VerticalSampleCard`), which is what lets a client component show the real
 * card without dragging the loyalty config, the colour maths and the icon
 * catalogue into the browser bundle. This file owns motion and nothing else.
 *
 * Scrolling is native `scroll-snap` rather than a transform: touch, trackpad
 * and shift-wheel work for free and identically to every other horizontal list
 * the visitor has used, and the row degrades to a plain scrollable strip if JS
 * never arrives — the arrows and the autoplay are enhancements, not the
 * mechanism.
 *
 * "Infinite" is the belt trick: the catalogue is laid down three times and the
 * scroll offset is quietly moved back a whole copy whenever it drifts out of
 * the middle one. Because every copy is identical, a jump of exactly one copy
 * width is invisible — nothing under the viewport changes. The re-centring runs
 * only once scrolling has SETTLED (a debounce), never mid-glide: assigning
 * `scrollLeft` during a smooth scroll cancels it, which would show up as a
 * stutter every time the belt came round.
 */
export default function LoyaltyCardCarousel({ slides }: { slides: CarouselSlide[] }) {
  const track = useRef<HTMLUListElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(0);

  // Autoplay stops for a reason, and the reasons are different. `stopped` is
  // the reader taking the wheel — permanent, because re-starting motion under
  // someone who just chose a card is hostile. The rest are conditions that come
  // and go on their own.
  const [stopped, setStopped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [calm, setCalm] = useState(false);

  const belt = useMemo(
    () => Array.from({ length: COPIES }, (_, copy) => slides.map((s) => ({ ...s, copy }))).flat(),
    [slides]
  );

  const metrics = useCallback(() => {
    const el = track.current;
    if (!el || !slides.length) return null;
    const slide = el.scrollWidth / belt.length;
    return { el, slide, copy: slide * slides.length };
  }, [belt.length, slides.length]);

  /** Put the offset back in the middle copy. Invisible: every copy is identical,
   *  so shifting by exactly one leaves the viewport showing the same cards. */
  const recentre = useCallback(() => {
    const m = metrics();
    if (!m) return;
    if (m.el.scrollLeft < m.copy * 0.5) m.el.scrollLeft += m.copy;
    else if (m.el.scrollLeft > m.copy * 1.5) m.el.scrollLeft -= m.copy;
  }, [metrics]);

  const sync = useCallback(() => {
    const m = metrics();
    if (!m) return;
    setActive(Math.round(m.el.scrollLeft / m.slide) % slides.length);
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(recentre, 140);
  }, [metrics, recentre, slides.length]);

  const step = useCallback(
    (delta: number) => {
      const m = metrics();
      if (!m) return;
      m.el.scrollBy({ left: delta * m.slide, behavior: calm ? "auto" : "smooth" });
    },
    [metrics, calm]
  );

  /** Dots address a trade, not a position on the belt, so take whichever copy of
   *  it is nearest — going 2 cards back beats 10 forward. */
  const goToTrade = useCallback(
    (index: number) => {
      const n = slides.length;
      let delta = index - active;
      if (delta > n / 2) delta -= n;
      if (delta < -n / 2) delta += n;
      step(delta);
    },
    [active, slides.length, step]
  );

  /** Anything the reader does deliberately hands them the wheel for good. */
  const takeOver = useCallback(() => setStopped(true), []);

  // Start in the middle copy so there is a catalogue to scroll back through.
  useEffect(() => {
    const m = metrics();
    if (m) m.el.scrollLeft = m.copy;
  }, [metrics]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setCalm(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // A row drifting along unseen is wasted work, and means the reader arrives
    // at a section that has silently wandered off its first card.
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sync]);

  const playing = !stopped && !hovered && !focused && onScreen && tabVisible && !calm;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => step(1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [playing, step]);

  useEffect(() => () => void (settle.current && clearTimeout(settle.current)), []);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Ejemplos de tarjetas de lealtad por giro"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      <ul
        ref={track}
        onScroll={sync}
        onPointerDown={takeOver}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          takeOver();
          step(e.key === "ArrowRight" ? 1 : -1);
        }}
        className="m-0 flex list-none snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-6 rounded-2xl px-6 pb-4 pt-1 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500 [&::-webkit-scrollbar]:hidden"
      >
        {belt.map((s, i) => (
          <li
            key={`${s.copy}-${s.slug}`}
            // Only the middle copy is announced; the other two are the same
            // twelve cards again and would just make the list read three times.
            aria-hidden={s.copy !== 1}
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${(i % slides.length) + 1} de ${slides.length}: ${s.label}`}
            className="flex w-[300px] shrink-0 snap-start flex-col sm:w-[336px]"
          >
            <Link
              href={`/lealtad/${s.slug}`}
              tabIndex={s.copy === 1 ? undefined : -1}
              className="group mb-3 flex items-center justify-between gap-2 rounded-xl px-1 no-underline"
            >
              <span className="text-sm font-bold text-gray-900 transition-colors group-hover:text-emerald-600">
                {s.label}
              </span>
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">
                {s.mechanic}
              </span>
            </Link>
            {/* Equal heights across the row: flex children already stretch, so
                this hands the full slide height down to the card, which
                distributes it internally. */}
            <div className="grow [&>div]:h-full">{s.card}</div>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-center gap-4">
        <Arrow
          dir="prev"
          onClick={() => {
            takeOver();
            step(-1);
          }}
        />
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {slides.map((s, i) => (
            <button
              key={s.slug}
              tabIndex={-1}
              onClick={() => {
                takeOver();
                goToTrade(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-emerald-500" : "w-1.5 bg-gray-200 hover:bg-gray-300"
              }`}
            />
          ))}
        </div>
        <Arrow
          dir="next"
          onClick={() => {
            takeOver();
            step(1);
          }}
        />
        {/* WCAG 2.2.2: motion that starts on its own and runs past five seconds
            needs a control that stops it, not only a hover pause a keyboard or
            touch reader cannot reach. Hidden entirely once reduced motion has
            already settled the question. */}
        {!calm && (
          <button
            type="button"
            onClick={() => setStopped((s) => !s)}
            aria-label={stopped ? "Reanudar el carrusel" : "Pausar el carrusel"}
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-emerald-500 hover:text-emerald-600"
          >
            {stopped ? <Play size={15} /> : <Pause size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Arrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Giro anterior" : "Giro siguiente"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-emerald-500 hover:text-emerald-600"
    >
      <Icon size={17} />
    </button>
  );
}
