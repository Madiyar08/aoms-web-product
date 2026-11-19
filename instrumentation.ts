/**
 * Background delivery worker bootstrap.
 *
 * We deliberately do not install a process-wide `uncaughtException` handler:
 * swallowing an unknown fatal exception can leave the server in an undefined
 * state while Railway still considers the process healthy. Expected network
 * errors must be caught at the operation that can recover from them.
 */
const workerGlobal = globalThis as typeof globalThis & { __aomsDeliveryWorkerStarted?: boolean };

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (workerGlobal.__aomsDeliveryWorkerStarted) return;

  workerGlobal.__aomsDeliveryWorkerStarted = true;
  const timer = setInterval(() => {
    void Promise.all([
      import("./lib/delivery-queue").then(({ processDeliveryQueueBatch }) => processDeliveryQueueBatch(3)),
      import("./lib/inspector-media-queue").then(({ processInspectorMediaQueueBatch }) => processInspectorMediaQueueBatch(2)),
    ]).catch((error) => console.error("[aoms-queue] worker tick failed", error));
  }, 3000);

  // Do not keep the process alive solely for this timer.
  (timer as unknown as { unref?: () => void }).unref?.();
}
