import {
  // IDefaultWallet,
  // IWallet
} from '@suiet/wallet-sdk';

import { get, writable } from 'svelte/store';

import { isNonEmptyArray } from '../utils/helpers';

import { walletDetection } from './walletDetection';

export const availableWallets = (defaultWallets) => {
  const availableWalletAdapters = get(walletDetection);

  const getConfiguredWallets = () => {
    if (!isNonEmptyArray(defaultWallets)) return [];

    if (!isNonEmptyArray(availableWalletAdapters)) {
      return defaultWallets.map(
        (item) =>
          ({
            ...item,
            adapter: undefined,
            installed: false,
          })
      );
    }

    return defaultWallets.map((item) => {
      const foundAdapter = availableWalletAdapters.find(
        (walletAdapter) => item.name === walletAdapter.name
      );

      if (foundAdapter) {
        return {
          ...item,
          adapter: foundAdapter,
          installed: true,
        };
      }
      
      return {
        ...item,
        adapter: undefined,
        installed: false,
      };
    });
  };

  const getDetectedWallets = () => {
    if (!isNonEmptyArray(availableWalletAdapters)) return [];
    return availableWalletAdapters
      .filter((adapter) => {
        // filter adapters not shown in the configured list
        return !defaultWallets.find((wallet) => wallet.name === adapter.name);
      })
      .map((adapter) => {
        // normalized detected adapter to IWallet
        return {
          name: adapter.name,
          label: adapter.name,
          adapter: adapter,
          installed: true,
          iconUrl: adapter.icon,
          downloadUrl: {
            browserExtension: "", // no need to know
          },
        };
      });
  };

  const configuredWallets = getConfiguredWallets();

  // detected wallets
  const detectedWallets = getDetectedWallets();

  // filter installed wallets
  const allAvailableWallets = writable([...configuredWallets, ...detectedWallets].filter(
    (wallet) => wallet.installed
  ));

  return {
    allAvailableWallets,
    configuredWallets,
    detectedWallets,
  };
};
