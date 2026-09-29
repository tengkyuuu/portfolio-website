export function PortraitPhoto({ name }: { name: string }) {
  return (
    <span className="portrait-photo">
      <img className="portrait-base" src="/no-shades.jpg" alt={name} />
      <img
        className="portrait-shades"
        src="/with-shades.png"
        alt=""
        aria-hidden="true"
        loading="eager"
      />
    </span>
  );
}
