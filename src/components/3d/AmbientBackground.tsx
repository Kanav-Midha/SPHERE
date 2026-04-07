export default function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 18% 20%, rgba(196, 141, 104, 0.14), transparent 24%), radial-gradient(circle at 82% 18%, rgba(140, 120, 100, 0.1), transparent 20%), radial-gradient(circle at 50% 84%, rgba(116, 126, 95, 0.12), transparent 28%), linear-gradient(180deg, #121112 0%, #0d0d0e 52%, #080809 100%)',
      }}
    >
      <div className="ambient-dots absolute inset-0 opacity-55" />
      <div className="ambient-vignette absolute inset-0" />

      <div className="ambient-ring ambient-ring-a" />
      <div className="ambient-ring ambient-ring-b" />
      <div className="ambient-ring ambient-ring-c" />

      <div className="ambient-arrow ambient-arrow-a" />
      <div className="ambient-arrow ambient-arrow-b" />
      <div className="ambient-arrow ambient-arrow-c" />

      <div className="ambient-glow ambient-glow-a" />
      <div className="ambient-glow ambient-glow-b" />
    </div>
  );
}
