'use client';

import { useState, useCallback } from 'react';

// Predefined config options
const CONFIG_PRESETS = [
  { name: 'None', value: '' },
  { name: 'ACL4SSR_Online', value: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini' },
  { name: 'ACL4SSR_Online_Full', value: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini' },
  { name: 'ACL4SSR_Online_Mini', value: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini.ini' },
  { name: 'Custom', value: 'custom' },
];

const TARGET_OPTIONS = [
  { name: 'Clash', value: 'clash' },
  { name: 'ClashR', value: 'clashr' },
  { name: 'Mixed (Base64)', value: 'mixed' },
];

export default function Home() {
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [target, setTarget] = useState('clash');
  const [configPreset, setConfigPreset] = useState('');
  const [customConfig, setCustomConfig] = useState('');
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [filename, setFilename] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const generateUrl = useCallback(() => {
    if (!subscriptionUrl) {
      alert('Please enter subscription URL');
      return;
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams();
    
    params.set('target', target);
    params.set('url', subscriptionUrl);
    
    const configUrl = configPreset === 'custom' ? customConfig : configPreset;
    if (configUrl) {
      params.set('config', configUrl);
    }
    
    if (include) params.set('include', include);
    if (exclude) params.set('exclude', exclude);
    if (filename) params.set('filename', filename);

    setGeneratedUrl(`${baseUrl}/api/sub?${params.toString()}`);
    setCopied(false);
  }, [subscriptionUrl, target, configPreset, customConfig, include, exclude, filename]);

  const copyToClipboard = useCallback(async () => {
    if (generatedUrl) {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedUrl]);

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Subconverter</h1>
          <p style={styles.subtitle}>Subscription Converter Service</p>
        </header>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Subscription Converter</h2>
          
          {/* Subscription URL */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Subscription URL *</label>
            <input
              type="text"
              value={subscriptionUrl}
              onChange={(e) => setSubscriptionUrl(e.target.value)}
              placeholder="Enter subscription URL (multiple URLs separated by |)"
              style={styles.input}
            />
          </div>

          {/* Target Format */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Target Format *</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              style={styles.select}
            >
              {TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Config Preset */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Remote Config</label>
            <select
              value={configPreset}
              onChange={(e) => setConfigPreset(e.target.value)}
              style={styles.select}
            >
              {CONFIG_PRESETS.map((opt) => (
                <option key={opt.name} value={opt.value}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Config URL */}
          {configPreset === 'custom' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Custom Config URL</label>
              <input
                type="text"
                value={customConfig}
                onChange={(e) => setCustomConfig(e.target.value)}
                placeholder="Enter custom config URL"
                style={styles.input}
              />
            </div>
          )}

          {/* Advanced Options Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={styles.toggleButton}
          >
            {showAdvanced ? '▼ Hide Advanced Options' : '▶ Show Advanced Options'}
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div style={styles.advancedSection}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Include (Regex)</label>
                <input
                  type="text"
                  value={include}
                  onChange={(e) => setInclude(e.target.value)}
                  placeholder="e.g. Hong Kong|Singapore"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Exclude (Regex)</label>
                <input
                  type="text"
                  value={exclude}
                  onChange={(e) => setExclude(e.target.value)}
                  placeholder="e.g. Expire|Traffic"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Filename</label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="e.g. config.yaml"
                  style={styles.input}
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button onClick={generateUrl} style={styles.generateButton}>
            Generate Link
          </button>

          {/* Generated URL */}
          {generatedUrl && (
            <div style={styles.resultSection}>
              <label style={styles.label}>Generated URL</label>
              <div style={styles.resultContainer}>
                <input
                  type="text"
                  value={generatedUrl}
                  readOnly
                  style={styles.resultInput}
                />
                <button onClick={copyToClipboard} style={styles.copyButton}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div style={styles.actionButtons}>
                <a
                  href={generatedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.openButton}
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          )}
        </div>

        {/* API Documentation */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>API Documentation</h2>
          <div style={styles.apiDoc}>
            <h3 style={styles.apiEndpoint}>GET /api/sub</h3>
            <p style={styles.apiDesc}>Convert subscription to target format</p>
            <table style={styles.paramTable}>
              <thead>
                <tr>
                  <th style={styles.paramTh}>Parameter</th>
                  <th style={styles.paramTh}>Required</th>
                  <th style={styles.paramTh}>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.paramTd}><code>url</code></td>
                  <td style={styles.paramTd}>Yes</td>
                  <td style={styles.paramTd}>Subscription URL (multiple URLs separated by |)</td>
                </tr>
                <tr>
                  <td style={styles.paramTd}><code>target</code></td>
                  <td style={styles.paramTd}>Yes</td>
                  <td style={styles.paramTd}>Target format: clash, clashr, mixed</td>
                </tr>
                <tr>
                  <td style={styles.paramTd}><code>config</code></td>
                  <td style={styles.paramTd}>No</td>
                  <td style={styles.paramTd}>Remote config URL (ACL4SSR format)</td>
                </tr>
                <tr>
                  <td style={styles.paramTd}><code>include</code></td>
                  <td style={styles.paramTd}>No</td>
                  <td style={styles.paramTd}>Include nodes matching regex</td>
                </tr>
                <tr>
                  <td style={styles.paramTd}><code>exclude</code></td>
                  <td style={styles.paramTd}>No</td>
                  <td style={styles.paramTd}>Exclude nodes matching regex</td>
                </tr>
                <tr>
                  <td style={styles.paramTd}><code>filename</code></td>
                  <td style={styles.paramTd}>No</td>
                  <td style={styles.paramTd}>Download filename</td>
                </tr>
              </tbody>
            </table>

            <h3 style={styles.apiEndpoint}>GET /api/version</h3>
            <p style={styles.apiDesc}>Get version information</p>
          </div>
        </div>

        <footer style={styles.footer}>
          <p>Powered by Next.js | <a href="https://github.com" style={styles.footerLink}>GitHub</a></p>
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
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    outline: 'none',
    background: 'white',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '0.5rem 0',
    marginBottom: '1rem',
  },
  advancedSection: {
    background: '#f8f9fa',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  generateButton: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'white',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  resultSection: {
    marginTop: '1.5rem',
    padding: '1rem',
    background: '#f0f4f8',
    borderRadius: '8px',
  },
  resultContainer: {
    display: 'flex',
    gap: '0.5rem',
  },
  resultInput: {
    flex: 1,
    padding: '0.75rem 1rem',
    fontSize: '0.9rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    background: 'white',
    boxSizing: 'border-box',
  },
  copyButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'white',
    background: '#28a745',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  actionButtons: {
    marginTop: '0.75rem',
  },
  openButton: {
    display: 'inline-block',
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    color: '#667eea',
    textDecoration: 'none',
    border: '2px solid #667eea',
    borderRadius: '6px',
  },
  apiDoc: {
    fontSize: '0.95rem',
  },
  apiEndpoint: {
    fontSize: '1.1rem',
    color: '#667eea',
    marginTop: '1.5rem',
    marginBottom: '0.5rem',
  },
  apiDesc: {
    color: '#666',
    marginBottom: '1rem',
  },
  paramTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  paramTh: {
    textAlign: 'left',
    padding: '0.75rem',
    background: '#f8f9fa',
    borderBottom: '2px solid #e0e0e0',
  },
  paramTd: {
    padding: '0.75rem',
    borderBottom: '1px solid #e0e0e0',
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
