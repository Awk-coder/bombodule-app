import { riskOf } from "../../domain/attendance";

export const riskLabel = (missed: number, limit: number) => (missed >= limit ? "Barred" : `${missed} / ${limit} missed`);

export function Meter({ missed, limit }: { missed: number; limit: number }) {
  return (
    <div class={`meter risk-${riskOf(missed, limit)}`}>
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} class={i < missed ? "on" : ""} />
      ))}
    </div>
  );
}
