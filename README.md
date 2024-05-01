# Sui Dapp

A library to encapsulate Sui logic into a consumable store for your Svelte or SvelteKit project.

### Installation (not yet available)

```sh
$ npm install @thirtysevenlabs/sui-dapp

```

### Usage

Inside a svelte component:

```javascript
import kiosk from '@thirtysevenlabs/sui-dapp/kiosk';
import sui from '@thirtysevenlabs/sui-dapp/sui';

import { page } from '$app/stores';

...

const handleWalletSelect = (wallet) => {
	$sui.wallet.select(wallet.name, true);
};

const handleConnect = () => {
	const isConnected = $sui.wallet.connected;

	...
};

...

<div>
	{#if ($sui.isInitialized && !$sui.wallet.connected)}
		<button on:click={handleConnect}>
			Connect
		</button>
	{:else}
		<span>
			{$sui.wallet.obfuscatedAddress}
		</span>
	{/if}
	<div>
		{$kiosk[$page.params.slug].itemCount}
	</div>
</div>

```

Or, inside another Svelte store:

```javascript
import kiosk from '@thirtysevenlabs/sui-dapp/kiosk';
import sui from '@thirtysevenlabs/sui-dapp/sui';

import { get } from 'svelte/store';

...

const createPTB = async () => {
	try {
		const { wallet } = get(sui);

		const tx = new TransactionBlock();

		tx.moveCall({
			arguments: [
				tx.pure(99),
				tx.pure('some string value')
			],
			target: `${PACKAGE_OBJECT_ID}::${FUNCTION_NAME_1}`
		});

		tx.moveCall({
			arguments: [
				tx.pure('some other string value'),
				tx.object(SOME_OBJECT_ID)
			],
			target: `${PACKAGE_OBJECT_ID}::${FUNCTION_NAME_2}`
		});

		await wallet.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			options: {
				showEffects: true
			}
		});
	} catch (err) {
		console.error(err);
	}
};

const getUserOwnedKiosks = async () => {
	try {
		await kiosk.getNextKioskBatch();
	} catch (err) {
		console.error(err);
	}
};
```

### Roadmap

1. Add to documentation, potentially using something like [Gitbook](https://www.gitbook.com).
2. Verify all functionality works according to spec.
3. Add test coverage.
4. Solicit feedback from community, issues, and PRs to continuously improve.


