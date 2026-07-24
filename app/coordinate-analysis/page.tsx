import { findCoordinateClusters, clusterSignature } from "@/lib/coordinate-analysis";
import { getDecisionBySignature } from "@/lib/cluster-decisions";
import { getSettingValue } from "@/lib/settings";
import { decideClusterAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CoordinateAnalysisPage() {
  const threshold = getSettingValue("coordinate_cluster_radius_meters", 30);
  const clusters = findCoordinateClusters(threshold);

  const pending = clusters.filter((c) => {
    const d = getDecisionBySignature(clusterSignature(c.atms.map((a) => a.id)));
    return !d || d.decision === "pending";
  });
  const merged = clusters.filter(
    (c) => getDecisionBySignature(clusterSignature(c.atms.map((a) => a.id)))?.decision === "merged"
  );
  const rejected = clusters.filter(
    (c) => getDecisionBySignature(clusterSignature(c.atms.map((a) => a.id)))?.decision === "rejected"
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Анализ координат</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Банкоматы ближе {threshold} м друг к другу — кандидаты на объединение в одну точку
        обслуживания. Порог меняется в «Настройках» → «Анализ координат».
      </p>

      <div className="flex gap-4 mb-5 text-[12.5px]">
        <span className="text-neutral-500">
          Всего групп: <b className="text-ink">{clusters.length}</b>
        </span>
        <span className="text-st-yellow">Ожидают решения: {pending.length}</span>
        <span className="text-route">Объединены: {merged.length}</span>
        <span className="text-st-red">Отклонены: {rejected.length}</span>
      </div>

      {clusters.length === 0 ? (
        <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
          Групп не найдено — либо банкоматов слишком мало, либо ни один не подошёл под порог {threshold} м.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {clusters.map((cluster, idx) => {
            const signature = clusterSignature(cluster.atms.map((a) => a.id));
            const decision = getDecisionBySignature(signature);
            return (
              <div key={signature} className="bg-white border border-line rounded-[10px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-ink">
                    Точка №{idx + 1} — {cluster.atms[0].address || cluster.atms[0].name}
                    <span className="ml-2 text-[11px] font-normal bg-st-yellow-bg text-st-yellow px-2 py-0.5 rounded">
                      {cluster.atms.length} банкоматов
                    </span>
                  </h4>
                  {decision && (
                    <span
                      className={`text-[11px] font-semibold px-2 py-1 rounded ${
                        decision.decision === "merged" ? "bg-route-bg text-route" : "bg-st-red-bg text-st-red"
                      }`}
                    >
                      {decision.decision === "merged" ? "Объединены" : "Отклонено"}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-neutral-500 mb-2">
                  {cluster.atms[0].district || "район не указан"} · расстояния между точками:{" "}
                  {cluster.sequentialDistances.map((d) => `${d} м`).join(", ")}
                </p>
                <table className="w-full text-[12px] mb-3">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase text-neutral-500 border-b border-line">
                      <th className="py-1.5">ID</th>
                      <th className="py-1.5">Название</th>
                      <th className="py-1.5">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cluster.atms.map((a) => (
                      <tr key={a.id} className="border-b border-line last:border-0">
                        <td className="py-1.5 font-mono text-neutral-500">{a.code || "без ID"}</td>
                        <td className="py-1.5">{a.name}</td>
                        <td className="py-1.5">{a.workStatusId ? "" : "не указан"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await decideClusterAction(signature, cluster.atms.map((a) => a.id), "merged");
                    }}
                  >
                    <button className="text-xs font-semibold bg-brass text-white rounded-md px-3 py-1.5">
                      ✅ Объединить в одну точку
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await decideClusterAction(signature, cluster.atms.map((a) => a.id), "rejected");
                    }}
                  >
                    <button className="text-xs font-semibold border border-line rounded-md px-3 py-1.5 bg-white">
                      ❌ Не объединять
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
