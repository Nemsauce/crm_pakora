"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MIN_DURATION_MS = 600;
const MAX_DURATION_MS = 900;
const DEFAULT_DURATION_MS = 760;
const reducedMotionSubscribers = new Set<() => void>();
let reducedMotionMediaQuery: MediaQueryList | null = null;

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
  className?: string;
};

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function getDuration(duration: number) {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duration));
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
  className,
}: AnimatedNumberProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [displayedValue, setDisplayedValue] = useState(value);
  const [hasStarted, setHasStarted] = useState(false);
  const currentValueRef = useRef(value);
  const hasAnimatedRef = useRef(false);
  const hasStartedRef = useRef(false);
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
  const formatValue = (nextValue: number) =>
    `${prefix}${formatter.format(nextValue)}${suffix}`;

  useEffect(() => {
    let animationFrame: number | null = null;

    if (prefersReducedMotion === null) {
      currentValueRef.current = value;
      return;
    }

    if (!Number.isFinite(value)) {
      hasAnimatedRef.current = false;
      currentValueRef.current = 0;
      hasStartedRef.current = false;
      animationFrame = window.requestAnimationFrame(() => {
        setDisplayedValue(value);
        setHasStarted(false);
      });
    } else if (prefersReducedMotion) {
      hasAnimatedRef.current = true;
      currentValueRef.current = value;
      hasStartedRef.current = false;
      animationFrame = window.requestAnimationFrame(() => {
        setDisplayedValue(value);
        setHasStarted(false);
      });
    } else {
      const startValue = hasAnimatedRef.current ? currentValueRef.current : 0;
      const targetValue = value;
      const animationDuration = getDuration(duration);
      let startedAt: number | null = null;

      hasAnimatedRef.current = true;

      const revealValue = () => {
        if (!hasStartedRef.current) {
          hasStartedRef.current = true;
          setHasStarted(true);
        }
      };

      if (Object.is(startValue, targetValue)) {
        animationFrame = window.requestAnimationFrame(() => {
          currentValueRef.current = targetValue;
          setDisplayedValue(targetValue);
          revealValue();
        });
      } else {
        const drawFrame = (timestamp: number) => {
          startedAt ??= timestamp;
          const progress = Math.min(
            (timestamp - startedAt) / animationDuration,
            1,
          );
          const nextValue =
            startValue + (targetValue - startValue) * easeOutCubic(progress);

          currentValueRef.current = nextValue;
          setDisplayedValue(nextValue);
          revealValue();

          if (progress < 1) {
            animationFrame = window.requestAnimationFrame(drawFrame);
            return;
          }

          currentValueRef.current = targetValue;
          setDisplayedValue(targetValue);
        };

        animationFrame = window.requestAnimationFrame(drawFrame);
      }
    }

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [duration, prefersReducedMotion, value]);

  const visibleValue =
    prefersReducedMotion === false && Number.isFinite(value)
      ? displayedValue
      : value;
  const isVisualReady =
    prefersReducedMotion === true ||
    !Number.isFinite(value) ||
    (prefersReducedMotion === false && hasStarted);

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
          aria-hidden="true"
          className="col-start-1 row-start-1 text-right"
          style={{ opacity: isVisualReady ? 1 : 0 }}
        >
          {formatValue(visibleValue)}
        </span>
      </span>
      <span className="sr-only">{formatValue(value)}</span>
    </span>
  );
}
