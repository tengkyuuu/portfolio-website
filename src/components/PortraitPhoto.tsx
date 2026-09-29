import { useState } from "react";
import portrait from "../assets/portrait.jpg";
import shades from "../assets/portrait-shades.png";

export function PortraitPhoto({ name }: { name: string }) {
  const [baseFailed, setBaseFailed] = useState(false);
  const [shadesFailed, setShadesFailed] = useState(false);
  return (
    <span className={`portrait-photo${shadesFailed ? " portrait-no-shades" : ""}`}>
      <img className="portrait-base" src={baseFailed ? "/james.jpg" : portrait} alt={name} onError={() => setBaseFailed(true)} />
      {!shadesFailed && <img
        className="portrait-shades"
        src={shades}
        alt=""
        aria-hidden="true"
        loading="eager"
        onError={() => setShadesFailed(true)}
      />}
    </span>
  );
}
