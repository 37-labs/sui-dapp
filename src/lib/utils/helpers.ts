// import { StandardConnectOutput, Wallet } from '@mysten/wallet-standard';

const UNOBFUSCATED_LENGTH = 4;

export function isNonEmptyArray(value: any): boolean {
  return Array.isArray(value) && value.length > 0;
}

export const isStandardWalletAdapterCompatibleWallet = (
  wallet
) => {
  return (
    "standard:connect" in wallet.features &&
    "standard:events" in wallet.features &&
    "sui:signAndExecuteTransactionBlock" in wallet.features
  );
}

export const getActiveChainFromConnectResult = (connectRes) => {
  if (connectRes?.accounts?.[0]?.chains?.[0]) {
    return connectRes.accounts[0].chains[0];
  }
  return 'sui:unknown';
}

export const obfuscateAddress = (address: string = ''): string => (
  `${address.slice(0, UNOBFUSCATED_LENGTH)}...${address.slice(-UNOBFUSCATED_LENGTH, address.length)}`
);

