import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PrivyProvider,
  usePrivy,
  useConnectWallet,
  useWallets
} from '@privy-io/react-auth';
import { base } from 'viem/chains';
import './privy.css';

const APP_ID = 'cmwlztaxg00v10hjym9n52hop';

function WalletPanel() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { wallets } = useWallets();

  const twitterAccount = user?.linkedAccounts?.find((account) => account.type === 'twitter');
  const twitterName = twitterAccount && 'username' in twitterAccount
    ? twitterAccount.username
    : undefined;
  const walletAddress = wallets.find((wallet) => wallet.walletClientType === 'privy')?.address
    ?? wallets[0]?.address;
  const displayName = twitterName ? `@${twitterName}`
    : walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : 'KICKERS Player';

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('kickers:identity', {
      detail: {
        displayName: authenticated ? displayName : 'KICKERS Player',
        walletAddress: authenticated ? (walletAddress ?? null) : null
      }
    }));
  }, [authenticated, displayName, walletAddress]);

  if (!ready) {
    return <div className="privy-bar"><span className="privy-status">CONNECTING PRIVY…</span></div>;
  }

  return (
    <div className="privy-bar">
      {authenticated ? (
        <>
          <span className="privy-status">{twitterName ? displayName : 'PLAYER CONNECTED'}</span>
          {walletAddress && <span className="privy-address">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>}
          <button type="button" className="privy-button secondary" onClick={() => connectWallet()}>
            CONNECT WALLET
          </button>
          <button type="button" className="privy-button secondary" onClick={() => logout()}>
            LOG OUT
          </button>
        </>
      ) : (
        <>
          <span className="privy-status">PLAYER ID + EVM WALLET</span>
          <button type="button" className="privy-button" onClick={() => login()}>
            LOGIN WITH X
          </button>
          <button type="button" className="privy-button secondary" onClick={() => connectWallet()}>
            CONNECT EVM WALLET
          </button>
        </>
      )}
    </div>
  );
}

function AuthApp() {
  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        defaultChain: base,
        supportedChains: [base],
        loginMethods: ['twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#65e7d9',
          showWalletLoginFirst: false
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets'
          }
        }
      }}
    >
      <WalletPanel />
    </PrivyProvider>
  );
}

const mount = document.getElementById('auth-root');
if (mount) createRoot(mount).render(<AuthApp />);
