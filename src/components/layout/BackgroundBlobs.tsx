export function BackgroundBlobs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[var(--z-index-ambient)] overflow-hidden text-[var(--color-accent)]"
    >
      <div className="absolute -left-28 -top-24 size-[28rem] rounded-full bg-[var(--color-accent)] opacity-[0.08] blur-[110px] dark:opacity-[0.16]" />
      <div className="absolute -bottom-36 -right-28 size-[34rem] rounded-full bg-[var(--color-accent-to)] opacity-[0.1] blur-[130px] dark:opacity-[0.18]" />

      <svg
        viewBox="0 0 360 280"
        fill="none"
        className="crm-ambient-route absolute -left-20 top-10 h-80 w-[28rem] opacity-[0.16] dark:opacity-[0.28]"
      >
        <path
          d="M18 54C92 12 125 115 204 81C266 54 264 173 342 138"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 12"
        />
        <circle
          className="crm-ambient-node"
          cx="18"
          cy="54"
          r="5"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          className="crm-ambient-node"
          cx="204"
          cy="81"
          r="4"
          fill="currentColor"
          stroke="currentColor"
        />
        <circle
          className="crm-ambient-node"
          cx="342"
          cy="138"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>

      <svg
        viewBox="0 0 420 300"
        fill="none"
        className="crm-ambient-route absolute -bottom-16 -right-20 h-96 w-[34rem] opacity-[0.16] dark:opacity-[0.28]"
      >
        <path
          d="M20 242C92 288 151 184 220 220C296 260 312 113 400 136"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 12"
        />
        <circle
          className="crm-ambient-node"
          cx="20"
          cy="242"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          className="crm-ambient-node"
          cx="220"
          cy="220"
          r="4"
          fill="currentColor"
          stroke="currentColor"
        />
        <circle
          className="crm-ambient-node"
          cx="400"
          cy="136"
          r="5"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
