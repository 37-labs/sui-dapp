export enum QueryKey {
  COIN_BALANCE = `SUIET_COIN_BALANCE`,
}

export enum StorageKey {
  LAST_CONNECT_WALLET_NAME = 'WK__LAST_CONNECT_WALLET_NAME',
}

export const queryKey = (key: string, opts: Record<string, any>) => {
  const uriQuery = new URLSearchParams(opts);
  return key + "?" + uriQuery.toString();
};
