import {
  ConnectionStatus,
  // IWallet
} from '@suiet/wallet-sdk';

import { StorageKey } from './constants';

import { isNonEmptyArray } from '../../utils/helpers';
import { Storage } from '../../utils/storage';

export const autoConnect = (
  select: (name: string) => Promise<void>,
  status: ConnectionStatus,
  allAvailableWallets,
  autoConnect: boolean
) => {
  let init = false;

  allAvailableWallets.subscribe(value => {
  	if (
      !autoConnect ||
      init ||
      !isNonEmptyArray(value) ||
      status !== ConnectionStatus.DISCONNECTED
    )
      return;

    const storage = new Storage();
    const lastConnectedWalletName = storage.getItem(
      StorageKey.LAST_CONNECT_WALLET_NAME
    );
    
    if (!lastConnectedWalletName) return;

    if (
      value.find((item) => item.name == lastConnectedWalletName)
    ) {
      select(lastConnectedWalletName)
        .then(() => {
          init = true;
        })
        .catch(() => {
          console.error('could not connect to last connected wallet');
        });
    }
  });

  return init;
};
