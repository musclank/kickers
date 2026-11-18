import { useEffect, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);

  const twitterAccount = user?.linkedAccounts?.find((account) => account.type === 'twitter_oauth');
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
    return <div className="connect-nav"><span className="privy-status">CONNECTING…</span></div>;
  }

  return (
    <nav className="connect-nav" aria-label="Account and wallet navigation">
      <button
        type="button"
        className={`connect-nav-trigger${menuOpen ? ' active' : ''}`}
        aria-expanded={menuOpen}
        aria-controls="connect-nav-menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="connect-nav-dot" />
        {authenticated ? 'ACCOUNT' : 'CONNECT'}
        <span className="connect-nav-chevron">{menuOpen ? '▲' : '▼'}</span>
      </button>
      {menuOpen && (
        <div className="connect-nav-menu" id="connect-nav-menu">
          <div className="connect-nav-heading">
            <strong>{authenticated ? 'PLAYER ACCOUNT' : 'CONNECT YOUR ACCOUNT'}</strong>
            <span>BASE NETWORK</span>
          </div>
          {authenticated && (
            <div className="connect-nav-identity">
              <span>{displayName}</span>
              <small>{walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'NO WALLET CONNECTED'}</small>
            </div>
          )}
          {!authenticated && (
            <button type="button" className="connect-nav-item x-login" onClick={() => { setMenuOpen(false); login(); }}>
              <span className="connect-nav-icon">𝕏</span>
              <span><strong>CONNECT WITH X</strong><small>Sign in with your X account</small></span>
            </button>
          )}
          {!walletAddress && (
            <button type="button" className="connect-nav-item" onClick={() => { setMenuOpen(false); connectWallet(); }}>
              <span className="connect-nav-icon">◈</span>
              <span><strong>CONNECT EVM WALLET</strong><small>MetaMask and other EVM wallets</small></span>
            </button>
          )}
          {authenticated && walletAddress && (
            <button type="button" className="connect-nav-item" onClick={() => { setMenuOpen(false); connectWallet(); }}>
              <span className="connect-nav-icon">◈</span>
              <span><strong>CHANGE / ADD WALLET</strong><small>Connect another EVM wallet</small></span>
            </button>
          )}
          <div className="connect-nav-network"><span className="connect-nav-dot" /> Ethereum Virtual Machine · Base</div>
          {authenticated && (
            <button type="button" className="connect-nav-logout" onClick={() => { setMenuOpen(false); logout(); }}>
              LOG OUT
            </button>
          )}
        </div>
      )}
    </nav>
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
