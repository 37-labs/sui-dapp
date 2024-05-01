import { useCoinBalance } from './coinBalance';

export interface UseAccountBalanceParams {
  typeArg?: string;
  chainId?: string;
}

export const getAccountBalance = (params?: UseAccountBalanceParams) => {
  const {
    typeArg,
    chainId,
  } = params || {};
  const res = useCoinBalance({
    typeArg,
    chainId,
  });

  return Object.assign(res, {
    // legacy interfaces
    balance: res.data,
    loading: res.isLoading,
  });
};
