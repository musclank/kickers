import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import './privy.css';

const APP_ID = 'cmwlztaxg00v10hjym9n52hop';

function WalletPanel() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [menuOpen, setMenuOpen] = useState(false);

  const twitterAccount = user?.linkedAccounts?.find((account) => account.type === 'twitter_oauth');
  const twitterName = twitterAccount && 'username' in twitterAccount
    ? twitterAccount.username
    : undefined;
  const displayName = twitterName ? `@${twitterName}` : 'KICKERS Player';

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('kickers:identity', {
      detail: {
        displayName: authenticated ? displayName : 'KICKERS Player',
        walletAddress: null
      }
    }));
  }, [authenticated, displayName]);

  if (!ready) {
    return <div className="connect-nav"><span className="privy-status">CONNECTING…</span></div>;
  }

  return (
    <nav className="connect-nav" aria-label="Account navigation">
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
            <span> X SIGN-IN </span>
          </div>
          {authenticated && (
            <div className="connect-nav-identity">
              <span>{displayName}</span>
              <small>CONNECTED WITH X</small>
            </div>
          )}
          {!authenticated && (
            <button type="button" className="connect-nav-item x-login" onClick={() => { setMenuOpen(false); login(); }}>
              <span className="connect-nav-icon">𝕏</span>
              <span><strong>CONNECT WITH X</strong><small>Sign in with your X account</small></span>
            </button>
          )}
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
        loginMethods: ['twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#65e7d9',
          showWalletLoginFirst: false
        }
      }}
    >
      <WalletPanel />
    </PrivyProvider>
  );
}

const mount = document.getElementById('auth-root');
if (mount) createRoot(mount).render(<AuthApp />);
