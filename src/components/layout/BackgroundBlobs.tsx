export function BackgroundBlobs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="background-blob -left-56 -top-52 h-[42rem] w-[42rem] bg-gradient-to-br from-accent-from/80 via-accent-pink/70 to-accent-orange/60"
        style={{ animationDuration: "21s", opacity: 0.64 }}
      />
      <div
        className="background-blob -right-56 -top-48 h-[46rem] w-[46rem] bg-gradient-to-br from-accent-blue/70 via-accent-to/70 to-accent-pink/60"
        style={{ animationDelay: "-8s", animationDuration: "24s", opacity: 0.58 }}
      />
      <div
        className="background-blob -bottom-56 -left-44 h-[40rem] w-[40rem] bg-gradient-to-tr from-accent-orange/65 via-accent-from/60 to-accent-blue/55"
        style={{ animationDelay: "-5s", animationDuration: "18s", opacity: 0.54 }}
      />
      <div
        className="background-blob -bottom-60 -right-40 h-[44rem] w-[44rem] bg-gradient-to-tr from-accent-pink/65 via-accent-to/60 to-accent-orange/55"
        style={{ animationDelay: "-13s", animationDuration: "25s", opacity: 0.56 }}
      />
    </div>
  );
}
