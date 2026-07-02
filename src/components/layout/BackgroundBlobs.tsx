export function BackgroundBlobs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="background-blob background-blob--one" />
      <div className="background-blob background-blob--two" />
      <div className="background-blob background-blob--three" />
      <div className="background-blob background-blob--four" />
    </div>
  );
}
