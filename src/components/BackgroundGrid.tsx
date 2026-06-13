export function BackgroundGrid() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Dot matrix — fades toward edges */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 90% 60% at 50% 0%, black 0%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 60% at 50% 0%, black 0%, transparent 100%)",
        }}
      />

      {/* Primary ambient glow — top center, slight indigo tint */}
      <div
        className="absolute left-1/2 top-0"
        style={{
          width: "min(1100px, 130vw)",
          height: "640px",
          transform: "translateX(-50%) translateY(-35%)",
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.065) 0%, rgba(160,140,255,0.018) 50%, transparent 72%)",
        }}
      />

      {/* Left mid glow */}
      <div
        className="absolute -left-48 top-1/4"
        style={{
          width: "560px",
          height: "560px",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 62%)",
        }}
      />

      {/* Right mid glow — cool tint */}
      <div
        className="absolute -right-48 top-1/3"
        style={{
          width: "560px",
          height: "560px",
          background:
            "radial-gradient(circle, rgba(180,200,255,0.025) 0%, transparent 62%)",
        }}
      />

      {/* Bottom diffuse glow */}
      <div
        className="absolute bottom-0 left-1/2"
        style={{
          width: "900px",
          height: "360px",
          transform: "translateX(-50%) translateY(40%)",
          background:
            "radial-gradient(ellipse, rgba(255,255,255,0.018) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
