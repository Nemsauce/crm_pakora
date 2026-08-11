"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MIN_DURATION_MS = 600;
const MAX_DURATION_MS = 900;
const DEFAULT_DURATION_MS = 760;
const reducedMotionSubscribers = new Set<() => void>();
let reducedMotionMediaQuery: MediaQueryList | null = null;

type NumberAnimationJob = {
  duration: number;
  from: number;
  startedAt: number | null;
  to: number;
  update: (value: number) => void;
};

const numberAnimationJobs = new Map<symbol, NumberAnimationJob>();
let sharedAnimationFrame: number | null = null;

export type AnimatedNumberProps = {
  value: number;
  locale?: string;
  style?: "decimal" | "currency" | "percent";
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  prefix?: string;
  suffix?: string;
  duration?: number;
  animateChanges?: boolean;
  className?: string;
};

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function getDuration(duration: number) {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duration));
}

function runNumberAnimations(timestamp: number) {
  sharedAnimationFrame = null;

  for (const [id, job] of numberAnimationJobs) {
    job.startedAt ??= timestamp;
    const progress = Math.min((timestamp - job.startedAt) / job.duration, 1);
    const nextValue = job.from + (job.to - job.from) * easeOutCubic(progress);

    job.update(progress === 1 ? job.to : nextValue);

    if (progress === 1) {
      numberAnimationJobs.delete(id);
    }
  }

  if (numberAnimationJobs.size > 0) {
    sharedAnimationFrame = window.requestAnimationFrame(runNumberAnimations);
  }
}

function scheduleNumberAnimation(id: symbol, job: NumberAnimationJob) {
  numberAnimationJobs.set(id, job);

  if (sharedAnimationFrame === null) {
    sharedAnimationFrame = window.requestAnimationFrame(runNumberAnimations);
  }
}

function cancelNumberAnimation(id: symbol) {
  numberAnimationJobs.delete(id);

  if (numberAnimationJobs.size === 0 && sharedAnimationFrame !== null) {
    window.cancelAnimationFrame(sharedAnimationFrame);
    sharedAnimationFrame = null;
  }
}

function getReducedMotionMediaQuery() {
  reducedMotionMediaQuery ??= window.matchMedia(REDUCED_MOTION_QUERY);
  return reducedMotionMediaQuery;
}

function notifyReducedMotionSubscribers() {
  reducedMotionSubscribers.forEach((subscriber) => subscriber());
}

function subscribeToReducedMotion(subscriber: () => void) {
  const mediaQuery = getReducedMotionMediaQuery();

  if (reducedMotionSubscribers.size === 0) {
    mediaQuery.addEventListener("change", notifyReducedMotionSubscribers);
  }

  reducedMotionSubscribers.add(subscriber);

  return () => {
    reducedMotionSubscribers.delete(subscriber);

    if (reducedMotionSubscribers.size === 0) {
      mediaQuery.removeEventListener("change", notifyReducedMotionSubscribers);
    }
  };
}

function getReducedMotionSnapshot() {
  return getReducedMotionMediaQuery().matches;
}

function getServerReducedMotionSnapshot() {
  return null;
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
}

export function AnimatedNumber({
  value,
  locale = "es-CO",
  style,
  currency,
  minimumFractionDigits,
  maximumFractionDigits,
  useGrouping,
  prefix = "",
  suffix = "",
  duration = DEFAULT_DURATION_MS,
  animateChanges = false,
  className,
}: AnimatedNumberProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationIdRef = useRef(Symbol("animated-number"));
  const currentValueRef = useRef(value);
  const hasAnimatedRef = useRef(false);
  const visibleValueRef = useRef<HTMLSpanElement>(null);
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: style ?? (currency ? "currency" : "decimal"),
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
        useGrouping,
      }),
    [
      currency,
      locale,
      maximumFractionDigits,
      minimumFractionDigits,
      style,
      useGrouping,
    ],
  );
  const formatValue = useMemo(
    () => (nextValue: number) =>
      `${prefix}${formatter.format(nextValue)}${suffix}`,
    [formatter, prefix, suffix],
  );

  useEffect(() => {
    const animationId = animationIdRef.current;
    const visibleValue = visibleValueRef.current;

    cancelNumberAnimation(animationId);

    if (!visibleValue) {
      return;
    }

    if (prefersReducedMotion === null) {
      currentValueRef.current = value;
      return;
    }

    const updateVisibleValue = (nextValue: number) => {
      currentValueRef.current = nextValue;
      visibleValue.textContent = formatValue(nextValue);
      visibleValue.style.opacity = "1";
    };

    if (!Number.isFinite(value)) {
      hasAnimatedRef.current = false;
      currentValueRef.current = 0;
      updateVisibleValue(value);
    } else if (prefersReducedMotion) {
      hasAnimatedRef.current = true;
      updateVisibleValue(value);
    } else {
      const hasAnimated = hasAnimatedRef.current;
      const startValue = hasAnimated ? currentValueRef.current : 0;
      const targetValue = value;

      hasAnimatedRef.current = true;

      if ((hasAnimated && !animateChanges) || Object.is(startValue, targetValue)) {
        updateVisibleValue(targetValue);
      } else {
        scheduleNumberAnimation(animationId, {
          duration: getDuration(duration),
          from: startValue,
          startedAt: null,
          to: targetValue,
          update: updateVisibleValue,
        });
      }
    }

    return () => cancelNumberAnimation(animationId);
  }, [animateChanges, duration, formatValue, prefersReducedMotion, value]);

  return (
    <span className={className}>
      <span className="inline-grid min-w-0 align-baseline">
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 text-right"
        >
          {formatValue(value)}
        </span>
        <span
          ref={visibleValueRef}
          aria-hidden="true"
          className="col-start-1 row-start-1 text-right"
          style={{ opacity: 0 }}
        />
      </span>
      <span className="sr-only">{formatValue(value)}</span>
    </span>
  );
}
