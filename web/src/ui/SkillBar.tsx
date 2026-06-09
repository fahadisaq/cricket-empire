import { skillColor } from "./format";

export function SkillBar({ value, label }: { value: number; label?: string }) {
  const color = skillColor(value);
  return (
    <div className="flex items-center gap-2">
      {label && <span className="w-24 text-xs text-slate-400 shrink-0">{label}</span>}
      <div className="skillbar flex-1">
        <span style={{ width: `${value}%`, background: color, color }} />
      </div>
      <span className="w-7 text-right text-xs font-semibold tabular-nums" style={{ color }}>
        {Math.round(value)}
      </span>
    </div>
  );
}
