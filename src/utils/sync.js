// 要件：非同期・分割・バッチ送信（ここではダミー実装）
// 実運用はAPIに差し替え可能な形にしてある
export function createSyncClient({ getState, setState }) {
  let timer = null;

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      await flush();
    }, 1200);
  };

  const flush = async () => {
    const state = getState();
    if (!state.settings.serverSyncEnabled) return;

    const pending = state.syncQueue || [];
    if (!pending.length) return;

    // 分割バッチ
    const batchSize = 50;
    const batch = pending.slice(0, batchSize);
    const rest = pending.slice(batchSize);

    // 擬似送信（本来は fetch(state.settings.serverEndpoint, ...)）
    await new Promise((r) => setTimeout(r, 250));

    setState((s) => ({
      ...s,
      syncQueue: rest,
      syncSentCount: (s.syncSentCount || 0) + batch.length
    }));

    // まだ残っていたら続けて送る
    if (rest.length) schedule();
  };

  return {
    enqueue(log) {
      setState((s) => ({
        ...s,
        syncQueue: [...(s.syncQueue || []), log]
      }));
      schedule();
    },
    flush
  };
}

