import { WalletRadar } from '@suiet/wallet-sdk';

import { writable } from 'svelte/store';

const initializeWalletAdapterDetection = () => {
  let walletRadar;

  const { set, subscribe } = writable([]);

  const mount = () => {
    if (!walletRadar) {
      walletRadar = new WalletRadar();

      walletRadar.activate();
    }

    const initialWalletAdapters = walletRadar.getDetectedWalletAdapters();

    set(initialWalletAdapters);
  };

  const unmount = () => {
    if (walletRadar) {
      walletRadar.deactivate();
      walletRadar = null;
    }
  };

  return {
    mount,
    subscribe,
    unmount
  };
};

export const walletDetection = initializeWalletAdapterDetection();
