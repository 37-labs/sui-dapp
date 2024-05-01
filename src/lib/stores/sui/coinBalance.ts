
import { SUI_TYPE_ARG } from '@mysten/sui.js/utils';
import { AccountAssetManager } from '@suiet/wallet-sdk';
import { useQuery } from '@tanstack/svelte-query';

import { get } from 'svelte/store';

import { QueryKey, queryKey } from './constants';

import { sui } from './index';

import { getChain } from "./chain";

export interface UseCoinBalanceParams {
  address?: string;
  typeArg?: string;
  chainId?: string;
}

export const coinBalance = (params?: UseCoinBalanceParams) => {
  const { wallet } = get(sui);

  const {
    address = wallet.address,
    typeArg = SUI_TYPE_ARG,
    chainId = wallet.chain?.id,
  } = params || {};

  const chain = getChain(chainId);

  const key = queryKey(QueryKey.COIN_BALANCE, {
    address,
    typeArg,
    chainId,
  });

  const getCoinBalance = () => {
    if (!address || !chain) return BigInt(0);

    const accountAssetManager = new AccountAssetManager(address, {
      chainRpcUrl: chain.rpcUrl,
    });

    return accountAssetManager.getCoinBalance(typeArg);
  };

  return useQuery(key, getCoinBalance, {
    initialData: BigInt(0)
  });
}
