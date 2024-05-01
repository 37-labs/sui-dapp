import { get } from 'svelte/store';

import { sui } from './index';

export const getChain = (chainId?: string) => {
  const { wallet } = get(sui);

  if (!chainId) return wallet.chain;

  return () => wallet.chains.find(w => w.id === chainId);
};
