export function BackgroundBlobs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden text-[var(--color-accent)]"
    >
      <svg
        viewBox="0 0 360 280"
        fill="none"
        className="absolute -left-24 top-16 h-72 w-96 opacity-[0.05] dark:opacity-[0.07]"
      >
        <path
          d="M18 54C92 12 125 115 204 81C266 54 264 173 342 138"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="3 10"
        />
        <circle cx="18" cy="54" r="5" stroke="currentColor" strokeWidth="2" />
        <circle
          cx="204"
          cy="81"
          r="4"
          fill="currentColor"
          stroke="currentColor"
        />
        <circle cx="342" cy="138" r="6" stroke="currentColor" strokeWidth="2" />
      </svg>

      <svg
        viewBox="0 0 420 300"
        fill="none"
        className="absolute -bottom-20 -right-28 h-80 w-[28rem] opacity-[0.05] dark:opacity-[0.07]"
      >
        <path
          d="M20 242C92 288 151 184 220 220C296 260 312 113 400 136"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="3 10"
        />
        <circle cx="20" cy="242" r="6" stroke="currentColor" strokeWidth="2" />
        <circle
          cx="220"
          cy="220"
          r="4"
          fill="currentColor"
          stroke="currentColor"
        />
        <circle cx="400" cy="136" r="5" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}
