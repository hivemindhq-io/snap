export type ChainConfig = {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  chainKey: string;
  currencySymbol: string;
  decimalPrecision: number;
  hasTagAtomId: string;
  trustworthyAtomId: string;
  hasAliasAtomId: string;
  rpcUrl: string;
  hivemindApiUrl: string;
};

export const INTUITION_TESTNET = {
  backendUrl: 'https://testnet.intuition.sh/v1/graphql',
  rpcUrl: 'https://testnet.rpc.intuition.systems',
  chainId: 13579,
  chainIdHex: '0x350B',
  chainName: 'Intuition Testnet',
  chainKey: 'intuition-testnet',
  currencySymbol: 'TTRUST',
  decimalPrecision: 18,
  hasTagAtomId: '0x6de69cc0ae3efe4000279b1bf365065096c8715d8180bc2a98046ee07d3356fd',
  trustworthyAtomId: '0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a',
  hasAliasAtomId: '0xf8cfb4e3f1db08f72f255cf7afaceb4b32684a64dac0f423cdca04dd15cf4fd6',
  hivemindApiUrl: 'https://api.hivemindhq.io',
};

export const INTUITION_MAINNET = {
  backendUrl: 'https://mainnet.intuition.sh/v1/graphql',
  rpcUrl: 'https://rpc.intuition.systems',
  chainId: 1155,
  chainIdHex: '0x483',
  chainName: 'Intuition Mainnet',
  chainKey: 'intuition-mainnet',
  currencySymbol: 'TRUST',
  decimalPrecision: 18,
  hasTagAtomId: '0x6de69cc0ae3efe4000279b1bf365065096c8715d8180bc2a98046ee07d3356fd',
  trustworthyAtomId: '0xe9c0e287737685382bd34d51090148935bdb671c98d20180b2fec15bd263f73a',
  hasAliasAtomId: '0xf8cfb4e3f1db08f72f255cf7afaceb4b32684a64dac0f423cdca04dd15cf4fd6',
  hivemindApiUrl: 'https://api.hivemindhq.io',
};

export const CHAIN_CONFIGS = [INTUITION_TESTNET, INTUITION_MAINNET];
export const chainConfig = process.env.CHAIN === 'mainnet' ? INTUITION_MAINNET : INTUITION_TESTNET;
