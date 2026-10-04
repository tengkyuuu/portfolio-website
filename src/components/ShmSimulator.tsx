import { useState } from "react";
import { RotateCcw } from "lucide-react";
import "./shm-simulator.css";

type Channel = { id: "deflection" | "acceleration" | "velocity"; label: string; unit: string; max: number; limit: number; step: number };
const channels: Channel[] = [
  { id: "deflection", label: "Deflection", unit: "mm", max: 12, limit: 6, step: 0.1 },
  { id: "acceleration", label: "Acceleration", unit: "m/s²", max: 5, limit: 2.5, step: 0.1 },
  { id: "velocity", label: "Velocity", unit: "mm/s", max: 16, limit: 8, step: 0.1 },
];
const initial = { deflection: 2.9, acceleration: 0.8, velocity: 3.2 };

/** Demonstration values and thresholds; never use this as a structural assessment. */
export function crossedChannels(readings: typeof initial): string[] {
  return channels.filter((channel) => readings[channel.id] > channel.limit).map((channel) => channel.label);
}

export function ShmSimulator() {
  const [readings, setReadings] = useState(initial);
  const crossed = crossedChannels(readings);
  const alert = crossed.length > 0;

  return (
    <section className="shm-simulator" aria-labelledby="shm-simulator-title">
      <div className="shm-simulator-head">
        <div>
          <h3 id="shm-simulator-title">Try the alert logic</h3>
          <p>Move a reading past its marked threshold to see how the dashboard state changes.</p>
        </div>
        <button type="button" onClick={() => setReadings(initial)} aria-label="Reset simulated readings">
          <RotateCcw size={14} aria-hidden="true" /> Reset
        </button>
      </div>

      <div className="shm-simulator-body">
        <div className="shm-simulator-controls">
          {channels.map((channel) => {
            const value = readings[channel.id];
            return (
              <div className="shm-simulator-control" key={channel.id}>
                <label htmlFor={`shm-${channel.id}`}>
                  <span>{channel.label}</span>
                  <strong>{value.toFixed(1)} <small>{channel.unit}</small></strong>
                </label>
                <input
                  id={`shm-${channel.id}`}
                  type="range"
                  aria-label={channel.label}
                  min="0"
                  max={channel.max}
                  step={channel.step}
                  value={value}
                  aria-valuetext={`${value.toFixed(1)} ${channel.unit}; illustrative alert above ${channel.limit} ${channel.unit}`}
                  onChange={(event) => setReadings((current) => ({ ...current, [channel.id]: Number(event.target.value) }))}
                />
                <div className="shm-simulator-scale"><span>0 {channel.unit}</span><span>Example limit {channel.limit} {channel.unit}</span></div>
              </div>
            );
          })}
        </div>
        <div className={`shm-simulator-result${alert ? " is-alert" : ""}`} role="status" aria-live="polite">
          <span className="shm-simulator-light" aria-hidden="true" />
          <p className="shm-simulator-result-label">SIMULATED NODE STATUS</p>
          <strong>{alert ? "Attention needed" : "Within example limits"}</strong>
          <p>{alert ? `${crossed.join(", ")} ${crossed.length === 1 ? "is" : "are"} above the example limit.` : "All three readings are below their example limits."}</p>
        </div>
      </div>
      <p className="shm-simulator-disclaimer">Illustrative readings and thresholds only. No live sensor data or structural safety assessment.</p>
    </section>
  );
}
