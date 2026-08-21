'use client';

import { useCallback, useEffect, useState } from 'react';

interface LinkItem {
  id: string;
  name: string;
  token: string;
  link: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  tokenRotatedAt: string;
}

interface SessionInfo {
  username: string | null;
  storageConfigured: boolean;
  registerEnabled: boolean;
  inviteRequired: boolean;
}

export default function AccountPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth form
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Links
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [linksError, setLinksError] = useState('');

  // Create form
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Per-row edit state
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState('');

  const loadLinks = useCallback(async () => {
    setLinksError('');
    try {
      const res = await fetch('/api/links');
      if (res.status === 401) {
        setLinks([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to load links (${res.status})`);
      setLinks(data.links || []);
    } catch (err) {
      setLinksError(err instanceof Error ? err.message : 'Failed to load links');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data: SessionInfo = await res.json();
        if (cancelled) return;
        setSession(data);
        if (data.username) await loadLinks();
      } catch {
        if (!cancelled) {
          setSession({
            username: null,
            storageConfigured: false,
            registerEnabled: true,
            inviteRequired: false,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Prefill the mapping when arriving from the converter page.
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('link');
    if (prefill) setNewLink(prefill);

    return () => {
      cancelled = true;
    };
  }, [loadLinks]);

  const submitAuth = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthBusy(true);
      setAuthError('');
      try {
        const res = await fetch(`/api/auth/${mode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, code: inviteCode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        setSession((prev) =>
          prev ? { ...prev, username: data.username } : prev
        );
        setPassword('');
        setInviteCode('');
        await loadLinks();
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        setAuthBusy(false);
      }
    },
    [mode, username, password, inviteCode, loadLinks]
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSession((prev) => (prev ? { ...prev, username: null } : prev));
    setLinks([]);
    setUsername('');
  }, []);

  const createLink = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);
      setCreateError('');
      try {
        const res = await fetch('/api/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newId, name: newName, link: newLink }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        setLinks((prev) => [...prev, data.link]);
        setNewId('');
        setNewName('');
        setNewLink('');
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create link');
      } finally {
        setCreating(false);
      }
    },
    [newId, newName, newLink]
  );

  const withRow = useCallback(
    async (id: string, action: () => Promise<void>) => {
      setRowBusy((prev) => ({ ...prev, [id]: true }));
      setRowError((prev) => ({ ...prev, [id]: '' }));
      try {
        await action();
      } catch (err) {
        setRowError((prev) => ({
          ...prev,
          [id]: err instanceof Error ? err.message : 'Request failed',
        }));
      } finally {
        setRowBusy((prev) => ({ ...prev, [id]: false }));
      }
    },
    []
  );

  const saveMapping = useCallback(
    (item: LinkItem) =>
      withRow(item.id, async () => {
        const value = editing[item.id] ?? item.link;
        const res = await fetch(`/api/links/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        setLinks((prev) => prev.map((l) => (l.id === item.id ? data.link : l)));
        setEditing((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }),
    [editing, withRow]
  );

  const rotateToken = useCallback(
    (item: LinkItem) =>
      withRow(item.id, async () => {
        if (!window.confirm(`Rotate the token of "${item.id}"? The old URL stops working.`)) {
          return;
        }
        const res = await fetch(`/api/links/${item.id}/token`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        setLinks((prev) => prev.map((l) => (l.id === item.id ? data.link : l)));
      }),
    [withRow]
  );

  const removeLink = useCallback(
    (item: LinkItem) =>
      withRow(item.id, async () => {
        if (!window.confirm(`Delete short link "${item.id}"?`)) return;
        const res = await fetch(`/api/links/${item.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        setLinks((prev) => prev.filter((l) => l.id !== item.id));
      }),
    [withRow]
  );

  const copy = useCallback(async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }, []);

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h2 style={styles.title}>My Subscriptions</h2>
          <p style={styles.subtitle}>
            Short, fixed subscription IDs · <a href="/" style={styles.headerLink}>Converter</a>
          </p>
        </header>

        {loading && <div style={styles.card}>Loading...</div>}

        {!loading && session && !session.storageConfigured && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Storage not configured</h2>
            <p style={styles.hint}>
              Accounts and short links need a Vercel Blob store. Connect one to the
              deployment so <code>BLOB_READ_WRITE_TOKEN</code> is available, and set
              <code> AUTH_SECRET</code> to a long random string.
            </p>
          </div>
        )}

        {!loading && session?.storageConfigured && !session.username && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <form onSubmit={submitAuth}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="3-32 characters: letters, digits, - and _"
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="At least 8 characters"
                  style={styles.input}
                />
              </div>
              {mode === 'register' && session.inviteRequired && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Invite Code</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    style={styles.input}
                  />
                </div>
              )}
              {authError && <div style={styles.error}>{authError}</div>}
              <button type="submit" disabled={authBusy} style={styles.primaryButton}>
                {authBusy ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
            {session.registerEnabled && (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setAuthError('');
                }}
                style={styles.linkButton}
              >
                {mode === 'login'
                  ? "Don't have an account? Create one"
                  : 'Already have an account? Sign in'}
              </button>
            )}
          </div>
        )}

        {!loading && session?.username && (
          <>
            <div style={styles.card}>
              <div style={styles.accountRow}>
                <div>
                  <div style={styles.accountName}>{session.username}</div>
                  <div style={styles.hint}>
                    {links.length} short link{links.length === 1 ? '' : 's'}
                  </div>
                </div>
                <button type="button" onClick={logout} style={styles.secondaryButton}>
                  Sign Out
                </button>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>New Short Link</h2>
              <form onSubmit={createLink}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>ID *</label>
                  <input
                    type="text"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder="e.g. home (3-32 characters)"
                    style={styles.input}
                  />
                  <div style={styles.hint}>
                    Subscription URL: <code>/api/s/&lt;id&gt;?token=...</code>
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Optional note"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Mapped /api/sub Link *</label>
                  <textarea
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    rows={3}
                    placeholder="https://your-domain/api/sub?target=clash&url=https%3A%2F%2Fexample.com%2Fsub"
                    style={styles.textarea}
                  />
                  <div style={styles.hint}>
                    Only this service&apos;s own <code>/api/sub</code> links are accepted.
                    Generate one on the <a href="/" style={styles.inlineLink}>converter page</a>.
                  </div>
                </div>
                {createError && <div style={styles.error}>{createError}</div>}
                <button type="submit" disabled={creating} style={styles.primaryButton}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </form>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Short Links</h2>
              {linksError && <div style={styles.error}>{linksError}</div>}
              {links.length === 0 && !linksError && (
                <p style={styles.hint}>No short links yet.</p>
              )}
              {links.map((item) => (
                <div key={item.id} style={styles.linkCard}>
                  <div style={styles.linkHeader}>
                    <span style={styles.linkId}>{item.id}</span>
                    {item.name && <span style={styles.linkName}>{item.name}</span>}
                  </div>

                  <label style={styles.label}>Subscription URL</label>
                  <div style={styles.resultContainer}>
                    <input readOnly value={item.url} style={styles.resultInput} />
                    <button
                      type="button"
                      onClick={() => copy(item.url, `url:${item.id}`)}
                      style={styles.copyButton}
                    >
                      {copied === `url:${item.id}` ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                  <label style={{ ...styles.label, marginTop: '0.75rem' }}>
                    Mapped /api/sub Link
                  </label>
                  <textarea
                    value={editing[item.id] ?? item.link}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    rows={3}
                    style={styles.textarea}
                  />

                  {rowError[item.id] && <div style={styles.error}>{rowError[item.id]}</div>}

                  <div style={styles.rowButtons}>
                    <button
                      type="button"
                      onClick={() => saveMapping(item)}
                      disabled={rowBusy[item.id]}
                      style={styles.smallPrimaryButton}
                    >
                      Save Mapping
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateToken(item)}
                      disabled={rowBusy[item.id]}
                      style={styles.smallButton}
                    >
                      Rotate Token
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLink(item)}
                      disabled={rowBusy[item.id]}
                      style={styles.smallDangerButton}
                    >
                      Delete
                    </button>
                  </div>
                  <div style={styles.hint}>
                    Token rotated {new Date(item.tokenRotatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <footer style={styles.footer}>
          <p>
            Powered by Next.js |{' '}
            <a href="https://github.com/slightc/subconverter-next" style={styles.footerLink}>
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  main: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '2rem 1rem',
  },
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
    color: 'white',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    margin: 0,
    textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
  },
  subtitle: {
    fontSize: '1.1rem',
    opacity: 0.9,
    marginTop: '0.5rem',
  },
  headerLink: {
    color: 'white',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '2rem',
    marginBottom: '1.5rem',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: '1.5rem',
    color: '#333',
    borderBottom: '2px solid #667eea',
    paddingBottom: '0.5rem',
  },
  formGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '500',
    color: '#555',
    fontSize: '0.9rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.9rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.5',
  },
  primaryButton: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'white',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '0.6rem 1.2rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#667eea',
    background: 'white',
    border: '2px solid #667eea',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  linkButton: {
    marginTop: '1rem',
    background: 'none',
    border: 'none',
    color: '#667eea',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: 0,
  },
  inlineLink: {
    color: '#667eea',
  },
  accountRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  accountName: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#333',
  },
  linkCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
    background: '#fafbfc',
  },
  linkHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  linkId: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  linkName: {
    fontSize: '0.9rem',
    color: '#888',
  },
  resultContainer: {
    display: 'flex',
    gap: '0.5rem',
  },
  resultInput: {
    flex: 1,
    padding: '0.6rem 0.8rem',
    fontSize: '0.85rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    background: 'white',
    boxSizing: 'border-box',
  },
  copyButton: {
    padding: '0.6rem 1.2rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'white',
    background: '#28a745',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  rowButtons: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.75rem',
    flexWrap: 'wrap',
  },
  smallPrimaryButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'white',
    background: '#667eea',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  smallButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#667eea',
    background: 'white',
    border: '2px solid #667eea',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  smallDangerButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#dc3545',
    background: 'white',
    border: '2px solid #dc3545',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '0.8rem',
    color: '#888',
    marginTop: '0.4rem',
  },
  error: {
    marginBottom: '0.75rem',
    fontSize: '0.85rem',
    color: '#dc3545',
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.9rem',
  },
  footerLink: {
    color: 'white',
  },
};
