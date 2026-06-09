import { useEffect, useState } from "react";
import { useGame, type RetiredView, type RecordsView } from "../store/gameStore";
import { roleEmoji } from "../ui/format";
import { Crown, Award, Star, Target } from "lucide-react";

export function Legends() {
  const fetchHOF = useGame((s) => s.fetchHallOfFame);
  const fetchRecords = useGame((s) => s.fetchRecords);
  const [hof, setHof] = useState<RetiredView[]>([]);
  const [records, setRecords] = useState<RecordsView | null>(null);
  const [tab, setTab] = useState<"legends" | "records">("legends");

  useEffect(() => {
    void fetchHOF().then(setHof);
    void fetchRecords().then(setRecords);
  }, [fetchHOF, fetchRecords]);

  return (
    <div className="p-6 max-w-5xl mx-auto rise">
      <h1 className="title-xl text-5xl flex items-center gap-3"><Crown className="text-yellow-400" size={40} /> LEGENDS</h1>
      <p className="text-slate-400">The greats who shaped the cricketing world.</p>

      <div className="mt-4 flex gap-2">
        <Tab active={tab === "legends"} onClick={() => setTab("legends")}>Hall of Fame ({hof.length})</Tab>
        <Tab active={tab === "records"} onClick={() => setTab("records")}>All-time records</Tab>
      </div>

      {tab === "legends" && (
        <div className="mt-5 card overflow-hidden">
          {hof.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No legends yet — as players retire over the seasons, the greats will be enshrined here.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Legend</th>
                  <th className="p-3">Last club</th>
                  <th className="p-3">M</th>
                  <th className="p-3">Runs</th>
                  <th className="p-3">Wkts</th>
                  <th className="p-3">🏆</th>
                  <th className="p-3">Retired</th>
                </tr>
              </thead>
              <tbody>
                {hof.map((h, i) => (
                  <tr key={h.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {i < 3 && <span>{["🥇", "🥈", "🥉"][i]}</span>}
                        <span>{roleEmoji(h.role)}</span>
                        <span className="text-white font-medium">{h.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center text-slate-400">{h.lastClubName}</td>
                    <td className="p-3 text-center text-slate-300">{h.career.matches}</td>
                    <td className="p-3 text-center text-white font-semibold">{h.career.runs.toLocaleString()}</td>
                    <td className="p-3 text-center text-white font-semibold">{h.career.wickets}</td>
                    <td className="p-3 text-center text-yellow-400">{h.career.titlesWon}</td>
                    <td className="p-3 text-center text-slate-500 text-xs">age {h.retiredAge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "records" && records && (
        <div className="mt-5 grid md:grid-cols-2 gap-4">
          <RecordCard icon={<Star size={16} />} title="Most runs" rows={records.runs} val={(c) => c.runs.toLocaleString()} />
          <RecordCard icon={<Target size={16} />} title="Most wickets" rows={records.wickets} val={(c) => `${c.wickets}`} />
          <RecordCard icon={<Crown size={16} />} title="Most titles" rows={records.titles} val={(c) => `${c.titlesWon}`} />
          <RecordCard icon={<Award size={16} />} title="Most MOM awards" rows={records.mom} val={(c) => `${c.manOfTheMatch}`} />
        </div>
      )}
    </div>
  );
}

function RecordCard({ icon, title, rows, val }: {
  icon: React.ReactNode; title: string;
  rows: { id: string; name: string; age: number; career: RecordsView["runs"][number]["career"] }[];
  val: (c: RecordsView["runs"][number]["career"]) => string;
}) {
  return (
    <div className="card p-5">
      <h3 className="font-head text-lg text-white mb-3 flex items-center gap-2 text-pitch-400">{icon}<span className="text-white">{title}</span></h3>
      <div className="space-y-1.5">
        {rows.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="w-4 text-xs text-slate-600">{i + 1}</span>
              <span className="text-slate-100">{p.name}</span>
              <span className="text-xs text-slate-500">age {p.age}</span>
            </span>
            <span className="text-white font-semibold">{val(p.career)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold ${active ? "bg-pitch-600/20 text-pitch-400" : "text-slate-400 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}
