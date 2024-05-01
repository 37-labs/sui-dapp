import { TransactionBlock } from '@mysten/sui.js/transactions';

import { sha256 } from 'js-sha256';

import { get, writable } from 'svelte/store';

import { KIOSK_TYPE } from '../../constants';

export interface Kiosk {
	extensions: string[];
	itemIds: string[];
	items: ObjectData[];
	kiosk: KioskData;
	listingIds: string[];
}

interface KioskData {
	id: string;
	allowExtensions: boolean;
	itemCount: number;
	owner: string;
	profits: string;
}

interface KioskResponse {
	ok: boolean;
	kioskId?: string;
}

interface KioskStore {
	[key: string]: KioskData;
}

interface Store {
	hasNextPage: boolean;
	keys: string[];
	kiosks: KioskStore;
}

const INITIAL_VALUE: Store = {
	hasNextPage: true,
	keys: [],
	store: {}
};

const initializeKiosk = () => {
	const store = writable(INITIAL_VALUE);
	const { set, subscribe, update } = store;

	let nextCursor: string = '';

	const clearStorage = () => {
		set(INITIAL_VALUE);
	};

	const createKiosk = async (): KioskResponse => {
		const res = { ok: true };

		try {
			const { wallet } = get(sui);

			const tx = new TransactionBlock();

			tx.moveCall({
				arguments: [
					kiosk,
					kioskOwnerCap,
					tx.pure(file.fileExtension),
					tx.pure(rawFileHash),
					tx.pure(name),
					tx.pure(file.fileType)
				],
				target: `${SUIAVE_BUCKET_PACKAGE}::define`
			});

			const [kiosk, kioskOwnerCap] = tx.moveCall({
				target: `${KIOSK_PACKAGE}::new`
			});

			tx.transferObjects(
				[kioskOwnerCap],
				tx.pure(wallet.address, 'address')
			);

			tx.moveCall({
				target: `${TRANSFER_PACKAGE}::public_share_object`,
				arguments: [ kiosk ],
				typeArguments: [KIOSK_TYPE]
			});

			const txRes = await wallet.signAndExecuteTransactionBlock({
				transactionBlock: tx,
				options: {
					showEffects: true
				}
			});

			const { objectId } = txRes?.objectChanges?.find(({ objectType }) => objectType === KIOSK_TYPE) ?? '';

			if (objectId) {
				res.kioskId = objectId;
			} else {
				throw new Error('could not determine kiosk id');
			}
		} catch (err) {
			console.error(err);

			res.ok = false;
		}

		return res;
	};

	const getNextKioskBatch = async () => {
		try {
			const { hasNextPage, keys } = get(store);

			if (!hasNextPage) {
				// no more kiosks to retrieve
				return;
			}

			const { kioskClient, wallet } = get(sui);

			if (!wallet.address) {
				throw new Error('wallet address is not defined');
			}

			const kiosksRequest = {
				address: wallet.address,
				// personalKioskType: SUIAVE_DROPLET_TYPE
			};

			if (nextCursor) {
				// adapt request to get next page
				kiosksRequest.pagination = nextCursor;
			}

			const {
				hasNextPage: newHasNextPage,
				kioskIds,
				// kioskOwnerCaps,
				nextCursor: newCursor
			} = await kioskClient.getOwnedKiosks(kiosksRequest);

			nextCursor = newCursor;

			const nextKiosks = await resolveKiosks(kioskIds);

			const newKeys = Object.keys(nextKiosks).reduce((acc, kioskId) => {
				if (!keys.includes(kioskId)) {
					acc.push(kioskId);
				}

				return acc;
			}, []);

			update(value => ({
				...value,
				hasNextPage: newHasNextPage,
				keys: [
					...value.keys,
					...newKeys
				],
				store: {
					...value.store,
					...nextKiosks
				}
			}));
		} catch (err) {
			console.error(err);
		}
	};

	const getSingleKiosk = async (kioskId: string) => {
		try {
			const { keys } = get(store);

			const kiosk = await resolveKiosk(kioskId);

			if (!kiosk) {
				throw new Error('could not find this kiosk');
			}

			const nextKeys = [...keys];

			if (!nextKeys.includes(kioskId)) {
				nextKeys.push(kioskId);
			}

			update(value => ({
				...value,
				keys: [
					...nextKeys
				],
				store: {
					...value.store,
					[kioskId]: kiosk
				}
			}));
		} catch (err) {
			console.error(err);
		}
	};

	const resolveKiosk = async (kioskId: string): Kiosk => {
		const { kioskClient, suiClient } = get(sui);

		const kiosk = await kioskClient.getKiosk({
			id: kioskId,
			options: {
				withKioskFields: true
			}
		});

		return kiosk;
	};

	const resolveKiosks = async (kioskIds: string[]): KioskStore => {
		const promises = kioskIds.map(kioskId => resolveKiosk(kioskId));

		const nextKiosks = {};

		const settled = await Promise.allSettled(promises);

		settled.forEach(({ status, value }) => {
			if (
				status === 'fulfilled'
			) {
				nextKiosks[value.kiosk.id] = value;
			}
		});

		return nextKiosks;
	};

	return {
		clearStorage,
		createKiosk,
		getNextKioskBatch,
		getSingleKiosk,
		subscribe
	};
};

export const kiosk = initializeKiosk();
