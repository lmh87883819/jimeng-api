import _ from "lodash";

import config from "./config.ts";

export type TokenLease = {
  token: string;
  release: () => void;
};

type QueueItem = {
  resolve: (lease: TokenLease) => void;
  reject: (err: unknown) => void;
};

class TokenScheduler {
  #inUse = new Map<string, number>();
  #queue: QueueItem[] = [];
  #draining = false;

  enabled() {
    return (config.system.tokens || []).length > 0;
  }

  get queueSize() {
    return this.#queue.length;
  }

  acquire(): Promise<TokenLease> {
    if (!this.enabled()) {
      return Promise.reject(new Error("TokenScheduler is disabled: no static tokens configured"));
    }

    return new Promise((resolve, reject) => {
      this.#queue.push({ resolve, reject });
      this.#drain();
    });
  }

  #pickToken(): string | null {
    const tokens = config.system.tokens || [];
    if (!tokens.length) return null;

    const concurrency = Math.max(1, Number(config.system.tokenConcurrency || 3));

    let picked: string | null = null;
    let pickedInUse = Number.POSITIVE_INFINITY;

    for (const token of tokens) {
      const inUse = this.#inUse.get(token) || 0;
      if (inUse >= concurrency) continue;
      if (inUse < pickedInUse) {
        picked = token;
        pickedInUse = inUse;
      }
    }

    return picked;
  }

  #lease(token: string): TokenLease {
    const next = (this.#inUse.get(token) || 0) + 1;
    this.#inUse.set(token, next);

    let released = false;
    const release = _.once(() => {
      if (released) return;
      released = true;
      const current = this.#inUse.get(token) || 0;
      const updated = Math.max(0, current - 1);
      if (updated === 0) this.#inUse.delete(token);
      else this.#inUse.set(token, updated);
      this.#drain();
    });

    return { token, release };
  }

  #drain() {
    if (this.#draining) return;
    this.#draining = true;
    try {
      while (this.#queue.length > 0) {
        const token = this.#pickToken();
        if (!token) return;
        const item = this.#queue.shift()!;
        try {
          item.resolve(this.#lease(token));
        } catch (err) {
          item.reject(err);
        }
      }
    } finally {
      this.#draining = false;
    }
  }
}

export default new TokenScheduler();

