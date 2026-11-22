'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_INTEGRATED_TOKEN_INFO,
  fetchIntegratedTokenInfo,
  getCachedIntegratedTokenInfo,
  type IntegratedTokenInfo,
} from './ethers-contracts';
import {
  subscribeWalletDiscovery,
  type Eip1193Provider,
} from './web3-wallet';

export function useIntegratedToken(provider?: Eip1193Provider | null) {
  const [tokenInfo, setTokenInfo] = useState<IntegratedTokenInfo>(
    DEFAULT_INTEGRATED_TOKEN_INFO,
  );

  const refreshTokenInfo = useCallback(
    async (explicitProvider?: Eip1193Provider | null) => {
      const info = await fetchIntegratedTokenInfo(explicitProvider ?? provider);
      setTokenInfo(info);
      return info;
    },
    [provider],
  );

  useEffect(() => {
    setTokenInfo(getCachedIntegratedTokenInfo());

    const handleTokenChange = () => {
      setTokenInfo(getCachedIntegratedTokenInfo());
    };
    window.addEventListener('anagu-token-info-changed', handleTokenChange);

    let resolvedFromWallet = false;
    const unsubscribe = subscribeWalletDiscovery((wallets) => {
      if (provider || wallets.length > 0) {
        if (!resolvedFromWallet || provider) {
          resolvedFromWallet = true;
          void refreshTokenInfo(provider ?? wallets[0]?.provider ?? null);
        }
      }
    });

    void refreshTokenInfo(provider);

    return () => {
      unsubscribe();
      window.removeEventListener('anagu-token-info-changed', handleTokenChange);
    };
  }, [provider, refreshTokenInfo]);

  return { tokenInfo, refreshTokenInfo };
}
