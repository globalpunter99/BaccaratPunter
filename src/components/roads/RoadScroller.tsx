// Horizontal scroll container for a road grid.
//
// Roads grow columns indefinitely as a shoe runs long, so a wide shoe has to
// scroll sideways. A scrollbar would eat vertical space in a screen that is
// already dense, so instead the overflow is signalled by a discreet pair of
// dots on the panel's edge: a dot on the right means there are more columns
// that way, a dot on the left means columns are hidden behind you. Both fade
// out when the road fits. The dots are also buttons — tapping one nudges the
// road a screenful in that direction, for people without a trackpad.

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Scroll to the far right whenever this value changes (new hands land at
   *  the right edge, so a live shoe should follow the action). */
  followKey?: string | number;
  /**
   * Width in px of the *filled* part of the road. Every road grid is drawn to
   * a minimum column count whether or not there are results in it, so the grid
   * being wider than the frame says nothing about whether there is anything to
   * scroll to. The dots key off this instead: no data, or data that already
   * fits, means no dots.
   */
  contentWidth?: number;
}

export default function RoadScroller({ children, followKey, contentWidth }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const content = contentWidth ?? el.scrollWidth;
    if (content <= 0) { setMore({ left: false, right: false }); return; }
    // 2px slack absorbs sub-pixel layout rounding, which would otherwise
    // leave a dot lit on a road that actually fits.
    setMore({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < content - 2,
    });
  }, [contentWidth]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The grid inside changes width as columns are added
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  // Follow the live end of the shoe when it grows past the right edge, but
  // only if the user is already parked there — otherwise a new hand would
  // yank the view away from a column they were studying.
  const wasAtEnd = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || followKey === undefined) return;
    // Follow the last result, not the far edge of the empty grid beyond it.
    const content = contentWidth ?? el.scrollWidth;
    if (wasAtEnd.current) el.scrollLeft = Math.max(0, content - el.clientWidth);
    measure();
  }, [followKey, contentWidth, measure]);

  function onScroll() {
    const el = ref.current;
    if (el) {
      const content = contentWidth ?? el.scrollWidth;
      wasAtEnd.current = el.scrollLeft + el.clientWidth >= content - 4;
    }
    measure();
  }

  function nudge(dir: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="road-scroller">
      <div className="road-scroll" ref={ref} onScroll={onScroll}>
        {children}
      </div>
      <button
        className={`road-more left${more.left ? " on" : ""}`}
        tabIndex={more.left ? 0 : -1}
        aria-hidden={!more.left}
        title="More columns to the left"
        onClick={() => nudge(-1)}
      />
      <button
        className={`road-more right${more.right ? " on" : ""}`}
        tabIndex={more.right ? 0 : -1}
        aria-hidden={!more.right}
        title="More columns to the right"
        onClick={() => nudge(1)}
      />
    </div>
  );
}
