// Setup Wizard - Firewall Automation Step

import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { safeInvoke } from '../utils/tauri';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { SuccessMessage } from '../components/common/SuccessMessage';
import { logger } from '../utils/logger';
import './SetupWizard.css';

interface FirewallPreviewRequest {
  os: string;
  ports: number[];
  ip_whitelist: string[];
}

interface FirewallPreviewResponse {
  script: string;
  display_name: string;
  shell: string;
}

interface FirewallApplyRequest {
  script: string;
  shell: string;
}

interface FirewallApplyResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export const SetupWizard: React.FC = () => {
  const { t: _t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [os, setOs] = useState<string>('');
  const [ports, setPorts] = useState<number[]>([8080, 8081]);
  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  const [previewScript, setPreviewScript] = useState<string>('');
  const [previewShell, setPreviewShell] = useState<string>('');
  const [previewDisplayName, setPreviewDisplayName] = useState<string>('');
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    // Detect OS
    const detectOS = async () => {
      try {
        const platform = await safeInvoke<string>('get_platform');
        // get_platform returns JSON string, parse it
        const platformObj = typeof platform === 'string' ? JSON.parse(platform) : platform;
        const osName = platformObj?.os || platformObj || platform;
        setOs(String(osName).toLowerCase());
      } catch (err) {
        logger.error('Failed to detect OS:', err);
        // Fallback to detecting from user agent or system
        if (navigator.platform.toLowerCase().includes('win')) {
          setOs('windows');
        } else if (navigator.platform.toLowerCase().includes('mac')) {
          setOs('macos');
        } else {
          setOs('linux');
        }
      }
    };
    detectOS();
  }, []);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const request: FirewallPreviewRequest = {
        os,
        ports,
        ip_whitelist: ipWhitelist,
      };

      const response = await safeInvoke<FirewallPreviewResponse>(
        'system_firewall_preview',
        request as unknown as Record<string, unknown>
      );

      setPreviewScript(response.script);
      setPreviewShell(response.shell);
      setPreviewDisplayName(response.display_name);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      setError(`Failed to generate firewall script: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!previewScript || !previewShell) {
      setError('Please generate a firewall script preview first');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const request: FirewallApplyRequest = {
        script: previewScript,
        shell: previewShell,
      };

      const response = await safeInvoke<FirewallApplyResponse>(
        'system_firewall_apply',
        request as unknown as Record<string, unknown>
      );

      if (response.exit_code === 0) {
        setSuccessMessage('Firewall rules applied successfully');
        setApplied(true);
      } else {
        setError(
          `Firewall application failed (exit code: ${response.exit_code})\n${response.stderr}`
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      setError(`Failed to apply firewall script: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await safeInvoke<FirewallApplyResponse>(
        'system_firewall_rollback',
        { os } as unknown as Record<string, unknown>
      );

      if (response.exit_code === 0) {
        setSuccessMessage('Firewall rules rolled back successfully');
        setApplied(false);
      } else {
        setError(
          `Firewall rollback failed (exit code: ${response.exit_code})\n${response.stderr}`
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      setError(`Failed to rollback firewall script: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(previewScript);
    setSuccessMessage('Script copied to clipboard');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const handleSaveScript = () => {
    const blob = new Blob([previewScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firewall-script-${Date.now()}.${previewShell === 'powershell' ? 'ps1' : 'sh'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccessMessage('Script saved to file');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  return (
    <div className="setup-wizard-page">
      <h1>Setup Wizard - Firewall Configuration</h1>

      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {successMessage && (
        <SuccessMessage
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      <div className="firewall-config-section">
        <h2>Configuration</h2>
        
        <div className="form-group">
          <label htmlFor="os-input">Operating System:</label>
          <input
            id="os-input"
            type="text"
            value={os}
            readOnly
            className="form-input"
            aria-label="Operating System (read-only)"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ports-input">Ports (comma-separated):</label>
          <input
            id="ports-input"
            type="text"
            value={ports.join(', ')}
            onChange={(e) => {
              const portList = e.target.value
                .split(',')
                .map((p) => parseInt(p.trim(), 10))
                .filter((p) => !isNaN(p));
              setPorts(portList);
            }}
            className="form-input"
            placeholder="8080, 8081"
            aria-label="Ports (comma-separated)"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ip-whitelist-input">IP Whitelist (comma-separated, optional):</label>
          <input
            id="ip-whitelist-input"
            type="text"
            value={ipWhitelist.join(', ')}
            onChange={(e) => {
              const ipList = e.target.value
                .split(',')
                .map((ip) => ip.trim())
                .filter((ip) => ip.length > 0);
              setIpWhitelist(ipList);
            }}
            className="form-input"
            placeholder="203.0.113.0/24, 2001:db8::/48"
            aria-label="IP Whitelist (comma-separated, optional)"
          />
        </div>

        <button
          onClick={handlePreview}
          disabled={loading || ports.length === 0}
          className="btn btn-primary"
        >
          Generate Script Preview
        </button>
      </div>

      {previewScript && (
        <div className="firewall-preview-section">
          <h2>Script Preview</h2>
          <div className="script-info">
            <p>
              <strong>Shell:</strong> {previewDisplayName}
            </p>
          </div>
          <div className="script-preview">
            <pre>{previewScript}</pre>
          </div>
          <div className="script-actions">
            <button
              onClick={handleCopyScript}
              className="btn btn-secondary"
            >
              Copy Script
            </button>
            <button
              onClick={handleSaveScript}
              className="btn btn-secondary"
            >
              Save Script
            </button>
            <button
              onClick={handleApply}
              disabled={loading || applied}
              className="btn btn-primary"
            >
              Apply Script (Requires Admin)
            </button>
            {applied && (
              <button
                onClick={handleRollback}
                disabled={loading}
                className="btn btn-danger"
              >
                Rollback
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <LoadingSpinner />}
    </div>
  );
};
