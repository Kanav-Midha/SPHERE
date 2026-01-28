interface GrainOverlayProps {
  opacity?: number;
}

export default function GrainOverlay({ opacity = 0.24 }: GrainOverlayProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        mixBlendMode: 'soft-light',
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\' viewBox=\'0 0 180 180\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.75\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'180\' height=\'180\' filter=\'url(%23n)\' opacity=\'.22\'/%3E%3C/svg%3E")',
      }}
    />
  );
}
