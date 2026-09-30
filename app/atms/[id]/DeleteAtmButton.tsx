"use client";

import { useRouter } from "next/navigation";
import { deleteAtmAction } from "../actions";

export function DeleteAtmButton({ id }: { id: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm("Удалить этот банкомат безвозвратно?")) return;
        await deleteAtmAction(id);
        router.push("/atms");
      }}
      className="text-[12px] text-st-red"
    >
      Удалить банкомат
    </button>
  );
}
