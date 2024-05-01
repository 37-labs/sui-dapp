import { KioskClient, Network } from '@mysten/kiosk';
import { SuiClient } from '@mysten/sui.js/client';
import type {
  StandardConnectInput,
  SuiSignAndExecuteTransactionBlockInput,
  SuiSignMessageInput,
  SuiSignPersonalMessageInput,
  SuiSignTransactionBlockInput
} from '@mysten/wallet-standard';
import {
	AllDefaultWallets,
	ConnectionStatus,
	DefaultChains,
	FeatureName,
	KitError,
	// IWalletAdapter,
	UnknownChain,
	verifySignedMessage
} from '@suiet/wallet-sdk';
// import { IdentifierString } from '@wallet-standard/core';

import { get, writable } from 'svelte/store';

import { PUBLIC_PACKAGE_OBJECT_ID } from '$env/static/public';

import { goto } from '$app/navigation';

import { notifications, NotificationVariant } from '../notifications';

import { availableWallets } from './availableWallets';
import { autoConnect } from './autoConnect';
import { INITIAL_WALLET_VALUE } from './wallet';
import { walletDetection } from './walletDetection';

import { StorageKey } from './constants';

import {
	getActiveChainFromConnectResult,
	isNonEmptyArray,
	obfuscatedAddress
} from '../../utils/helpers';
import { Storage } from '../../utils/storage';

const INITIAL_VALUE = {
	isInitialized: false,
	kioskClient: undefined,
	normalizedModules: {},
	suiClient: undefined,
	wallet: INITIAL_WALLET_VALUE
};

const initializeSui = () => {
	const store = writable(INITIAL_VALUE);
	const { set, subscribe, update } = store;

	let kioskClient;
	let suiClient;
	let walletOfListeners = [];

	let off = () => {};

	const connect = async (adapter: IWalletAdapter, opts?: StandardConnectInput) => {
		if (!adapter) throw new KitError('param adapter is missing');

		update(value => ({
			...value,
			wallet: {
				...value.wallet,
				adapter,
				connecting: true,
				status: ConnectionStatus.CONNECTING
			}
		}));

		const { wallet } = get(store);
  	const { chain: prevChain } = wallet;

		let nextChain = prevChain;

		try {
			const res = await adapter.connect(opts);

			// try to get chain from the connected account
			if (isNonEmptyArray((res as any)?.accounts)) {
				const chainId = getActiveChainFromConnectResult(res);
				const targetChain = DefaultChains.find((item) => item.id === chainId);

				nextChain = targetChain ?? UnknownChain;
			}

			suiClient = new SuiClient({ url: nextChain.rpcUrl });

			kioskClient = new KioskClient({
				client: suiClient,
				network: Network[nextChain.id.split(':')[1].toUpperCase()]
			});

			const normalizedModules = await getModules(suiClient);

			const address = adapter.accounts[0]?.address;

			update(value => ({
				...value,
				kioskClient,
				normalizedModules,
				suiClient,
				wallet: {
					...value.wallet,
					address,
					connecting: false,
					connected: true,
					chain: nextChain,
					name: adapter?.name,
					obfuscatedAddress: obfuscateAddress(address),
					status: ConnectionStatus.CONNECTED
				}
			}));

			off = on('chainChange', async (params: { chain: string }) => {
				const { wallet } = get(store);
				const { chain } = wallet;

	      if (params.chain === chain.id) return;

	      const newChain = DefaultChains.find((item) => item.id === params.chain);

	      if (!newChain) {
	        update(value => ({
						...value,
						wallet: {
							...value.wallet,
							chain: UnknownChain
						}
					}));

	        return;
	      }

	      suiClient = new SuiClient({ url: newChain.rpcUrl });

	      kioskClient = new KioskClient({
					client: suiClient,
					network: Network[newChain.id.split(':')[1].toUpperCase()]
				});

	      const normalizedModules = await getModules(suiClient, true);

	      update(value => ({
					...value,
					kioskClient,
					normalizedModules,
					suiClient,
					wallet: {
						...value.wallet,
						chain: newChain
					}
				}));
	    });

			const storage = new Storage();
			storage.setItem(StorageKey.LAST_CONNECT_WALLET_NAME, adapter.name);

			return res;
		} catch (e) {
			update(value => ({
				...value,
				wallet: {
					...value.wallet,
					adapter: undefined,
					address: undefined,
					connecting: false,
					connected: false,
					name: undefined,
					obfuscatedAddress: undefined,
					status: ConnectionStatus.DISCONNECTED
				}
			}));

			throw e;
		}
  };

	const disconnect = async () => {
		const { wallet } = get(store);
  	const { adapter, status } = wallet;

		ensureCallable(adapter, status);

		const _adapter = adapter as IWalletAdapter;

		// try to clear listeners
		if (isNonEmptyArray(walletOfListeners)) {
			walletOfListeners.forEach((off) => {
				try {
					off();
				} catch (e) {
					console.error(
						'error when clearing wallet listener',
						(e as any).message
					);
				}
			});

			walletOfListeners = []; // empty array

			goto('/');
		}

		// clear storage for last connected wallet
		// if users disconnect wallet manually
		const storage = new Storage();
		storage.removeItem(StorageKey.LAST_CONNECT_WALLET_NAME);

		try {
			// disconnect is an optional action for wallet
			if (_adapter.hasFeature(FeatureName.STANDARD__DISCONNECT)) {
				await _adapter.disconnect();
			}
		} finally {
			update(value => ({
				...value,
				wallet: {
					...value.wallet,
					adapter: undefined,
					address: undefined,
					connecting: false,
					connected: false,
					chain: UnknownChain,
					obfuscatedAddress: undefined,
					status: ConnectionStatus.DISCONNECTED
				}
			}));
		}
	};

	const ensureCallable = (
		walletAdapter: IWalletAdapter | undefined,
		status: ConnectionStatus
	) => {
		if (!isCallable(walletAdapter, status)) {
			throw new KitError('Failed to call function, wallet not connected');
		}
	};

	const getAccount = () => {
		const { wallet } = get(store);
  	const { adapter, status } = wallet;

    if (!isCallable(adapter, status)) return;

    return (adapter as IWalletAdapter).accounts[0]; // use first account by default
  };

	const getAccounts = () => {
		const { wallet } = get(store);
  	const { adapter, status } = wallet;

    ensureCallable(adapter, status);

    const _wallet = adapter as IWalletAdapter;
    return _wallet.accounts;
  };

  const getModules = async (suiClient, shouldLogSuccess?: boolean) => {
  	let normalizedModules = {};

		try {
			normalizedModules = await suiClient.getNormalizedMoveModulesByPackage({
				package: PUBLIC_PACKAGE_OBJECT_ID
			});

			if (shouldLogSuccess) {
				notifications.sendNotification({
					description: 'Connected to supported Sui network.',
					name: 'Success',
					variant: NotificationVariant.Success
				});
			}
		} catch (err) {
			console.error(err);

			notifications.sendNotification({
				description: 'You appear to be on an unsupported Sui network.',
				name: 'Error',
				variant: NotificationVariant.Error
			});
		}

		return normalizedModules;
  };

	const isCallable = (
		walletAdapter: IWalletAdapter | undefined,
		status: ConnectionStatus
	) => walletAdapter && status === ConnectionStatus.CONNECTED;

	const mount = () => {
		if (!suiClient) {
			walletDetection.mount();

			const { allAvailableWallets, configuredWallets, detectedWallets } = availableWallets(AllDefaultWallets);

			const status = ConnectionStatus.DISCONNECTED;

			set({
				isInitialized: true,
				normalizedModules: {},
				wallet: {
					adapter: undefined,
					address: undefined,
					allAvailableWallets: get(allAvailableWallets),
					chain: !isNonEmptyArray(DefaultChains) ? DefaultChains[0] : UnknownChain,
					chains: DefaultChains,
					configuredWallets,
					connected: false,
					connecting: false,
					detectedWallets,
					disconnect,
					getAccount,
					getAccounts,
					name: undefined,
					obfuscatedAddress: undefined,
					on,
					select,
					signAndExecuteTransactionBlock,
					signMessage,
					signPersonalMessage,
					signTransactionBlock,
					status,
					verifySignedMessage
				}
			});

			autoConnect(select, status, allAvailableWallets, true);
		}
	};

	const on = (event: WalletEvent, listener: WalletEventListeners[WalletEvent]) => {
		const { wallet } = get(store);
  	const { adapter, status } = wallet;

    ensureCallable(adapter, status);

    const _wallet = adapter as IWalletAdapter;

    // filter event and params to decide when to emit
    const _off = _wallet.on('change', (params) => {
      if (event === 'change') {
        const _listener = listener as WalletEventListeners['change'];
        _listener(params);
        return;
      }
      if (params.chains && event === 'chainChange') {
        const _listener = listener as WalletEventListeners['chainChange'];
        _listener({ chain: (params.chains as any)?.[0] });
        return;
      }
      if (params.accounts && event === 'accountChange') {
        const _listener = listener as WalletEventListeners['accountChange'];
        _listener({ account: (params.accounts as any)?.[0] });
        return;
      }
      if (params.features && event === 'featureChange') {
        const _listener = listener as WalletEventListeners['featureChange'];
        _listener({ features: params.features });
        return;
      }
    });

    walletOfListeners.push(_off); // should help user manage off cleaners
    return _off;
  };

	const select = async (walletName: string, autoRedirect: boolean) => {
		const { wallet } = get(store);
		const { adapter, allAvailableWallets, status } = wallet;

    // disconnect previous connection if it exists
    if (isCallable(adapter, status)) {
      const _adapter = adapter as IWalletAdapter;
      // Same wallet, ignore
      if (walletName === _adapter.name) return;

      // else first disconnect current wallet
      await disconnect();
    }

    const _wallet = allAvailableWallets.find(
      (w) => w.name === walletName
    );

    if (!_wallet) {
      const availableWalletNames = allAvailableWallets.map(
        (_wallet) => _wallet.name
      );

      throw new KitError(
        `select failed: wallet ${walletName} is not available, all wallets are listed here: [${availableWalletNames.join(
          ', '
        )}]`
      );
    }

    await connect(_wallet.adapter as IWalletAdapter);

    if (autoRedirect) {
    	goto('/files');
    }
  };

  const signAndExecuteTransactionBlock = async (
    input: Omit<SuiSignAndExecuteTransactionBlockInput, 'account' | 'chain'>
  ) => {
  	const { wallet } = get(store);
  	const { adapter, status } = wallet;

    ensureCallable(adapter, status);

    const account = getAccount();

    if (!account) {
      throw new KitError('no active account');
    }

    const _wallet = adapter as IWalletAdapter;

    return await _wallet.signAndExecuteTransactionBlock({
      account,
      chain: wallet.chain.id,
      ...input,
    });
  };

  const signMessage = async (input: Omit<SuiSignMessageInput, 'account'>) => {
  	const { wallet } = get(store);
  	const { adapter, status } = wallet;

    ensureCallable(adapter, status);

    const account = getAccount();

    if (!account) {
      throw new KitError('no active account');
    }

    const _adapter = adapter as IWalletAdapter;

    return await _adapter.signMessage({
      account,
      message: input.message,
    });
  };

  const signPersonalMessage = async (input: Omit<SuiSignPersonalMessageInput, 'account'>) => {
  	const { wallet } = get(store);
  	const { adapter, status } = wallet;

    ensureCallable(adapter, status);

    const account = getAccount();

    if (!account) {
      throw new KitError('no active account');
    }

    const _adapter = adapter as IWalletAdapter;

    return await _adapter.signPersonalMessage({
      account,
      message: input.message,
    });
  };

  const signTransactionBlock = async (input: Omit<SuiSignTransactionBlockInput, 'account' | 'chain'>) => {
  	const { wallet } = get(store);
  	const { adapter, status } = wallet;

    ensureCallable(adapter, status);

    const account = getAccount();

    if (!account) {
      throw new KitError('no active account');
    }

    const _wallet = adapter as IWalletAdapter;

    return await _wallet.signTransactionBlock({
      account,
      chain: wallet.chain.id,
      ...input,
    });
  };

	const unmount = () => {
		walletDetection.unmount();

		off();
	};

	return {
		mount,
		subscribe,
		unmount
	};
};

export const sui = initializeSui();
