// SPDX-License-Identifier: MIT
// SetupWizard - Setup Wizard page for external publish setup

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import {
  performPreCheck,
  detectOS,
  generateFirewallScript,
  validateIpWhitelist,
  PreCheckResult,
  FirewallScript,
} from '../services/setupWizard';
import {
  fetchProxyStatus,
  ProxyStatus,
} from '../services/dashboard';
import {
  fetchSecurityPolicy,
  saveSecurityPolicy,
  SecurityPolicyInput,
} from '../services/apiSetup';
import { safeInvoke } from '../utils/tauri';
import './SetupWizard.css';

type WizardStep = 1 | 2 | 3 | 4 | 5;

export const SetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showError, showSuccess } = useNotifications();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Pre-check
  const [preCheckResult, setPreCheckResult] = useState<PreCheckResult | null>(null);

  // Step 2: Proxy Mode & Port
  const [proxyMode, setProxyMode] = useState<string>('https-acme');
  const [proxyPort, setProxyPort] = useState<number>(8080);
  const [acmeEmail, setAcmeEmail] = useState<string>('');
  const [acmeDomain, setAcmeDomain] = useState<string>('');
  const [bindAddress, setBindAddress] = useState<string>('0.0.0.0');

  // Step 3: Security Policy
  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  const [ipWhitelistText, setIpWhitelistText] = useState<string>('');
  const [corsEnabled, setCorsEnabled] = useState<boolean>(false);
  const [rateLimitEnabled, setRateLimitEnabled] = useState<boolean>(true);
  const [rateLimitRpm, setRateLimitRpm] = useState<number>(60);
  const [rateLimitBurst, setRateLimitBurst] = useState<number>(10);

  // Step 4: Firewall
  const [detectedOS, setDetectedOS] =
    useState<'windows' | 'macos' | 'linux' | 'unknown'>('unknown');
  const [firewallScript, setFirewallScript] = useState<FirewallScript | null>(null);
  const [firewallApplied, setFirewallApplied] = useState<boolean>(false);
  const [caInstalling, setCaInstalling] = useState<boolean>(false);
  const [caInstallStatus, setCaInstallStatus] =
    useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [caInstallError, setCaInstallError] = useState<string | null>(null);

  // Step 5: Summary
  const [finalProxyStatus, setFinalProxyStatus] = useState<ProxyStatus | null>(null);
  const [finalApiKey, setFinalApiKey] = useState<string | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'セットアップウィザード' },
    ],
    [t]
  );

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [preCheck, os] = await Promise.all([performPreCheck(), detectOS()]);
        setPreCheckResult(preCheck);
        setDetectedOS(os);

        // Load existing proxy status if available
        const proxyStatus = await fetchProxyStatus();
        if (proxyStatus?.running) {
          setProxyMode(proxyStatus.mode || 'https-acme');
          setProxyPort(proxyStatus.port || 8080);
        }

        // Load existing security policy
        const policy = await fetchSecurityPolicy();
        setIpWhitelist(policy.ipWhitelist);
        setIpWhitelistText(policy.ipWhitelist.join('\n'));
        setCorsEnabled(policy.cors !== null);
        setRateLimitEnabled(policy.rateLimit !== null);
        if (policy.rateLimit) {
          setRateLimitRpm(policy.rateLimit.requestsPerMinute);
          setRateLimitBurst(policy.rateLimit.burstSize);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '初期データの読み込みに失敗しました'
        );
      } finally {
        setLoading(false);
      }
    };
    void loadInitialData();
  }, []);

  const handleNext = async () => {
    if (currentStep === 1) {
      if (preCheckResult && preCheckResult.issues.length > 0) {
        showError('すべての問題を解決してから次に進んでください');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (proxyMode === 'https-acme' && (!acmeEmail || !acmeDomain)) {
        showError('ACMEモードにはメールアドレスとドメインが必要です');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Validate IP whitelist
      const validation = validateIpWhitelist(ipWhitelist);
      if (validation.warnings.length > 0) {
        const proceed = confirm(
          validation.warnings.join('\n') + '\n\n続行しますか？'
        );
        if (!proceed) {
          return;
        }
      }

      // Generate firewall script
      const ports = [proxyPort];
      const script = await generateFirewallScript(ports, ipWhitelist, detectedOS);
      setFirewallScript(script);
      setCurrentStep(4);
    } else if (currentStep === 4) {
      setCurrentStep(5);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  };

  const handleSaveSecurityPolicy = async () => {
    try {
      const policyInput: SecurityPolicyInput = {
        ipWhitelist: ipWhitelist,
        cors: corsEnabled
          ? {
              allowedOrigins: ['*'],
              allowedMethods: ['GET', 'POST'],
              allowedHeaders: ['Content-Type', 'Authorization'],
            }
          : null,
        rateLimit: rateLimitEnabled
          ? {
              requestsPerMinute: rateLimitRpm,
              burstSize: rateLimitBurst,
            }
          : null,
      };
      await saveSecurityPolicy(policyInput);
      showSuccess('セキュリティポリシーを保存しました');
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'セキュリティポリシーの保存に失敗しました'
      );
    }
  };

  const handleStartProxy = async () => {
    try {
      await safeInvoke('ipc_proxy_start', {
        mode: proxyMode,
        port: proxyPort,
        bind: bindAddress,
        acme_email: acmeEmail || null,
        acme_domain: acmeDomain || null,
        no_daemon: false,
      });
      showSuccess('プロキシを起動しました');
      const status = await fetchProxyStatus();
      setFinalProxyStatus(status);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'プロキシの起動に失敗しました'
      );
    }
  };

  const handleComplete = async () => {
    // Save security policy
    await handleSaveSecurityPolicy();

    // Start proxy if not running
    if (!finalProxyStatus?.running) {
      await handleStartProxy();
    }

    showSuccess('セットアップが完了しました');
    navigate('/dashboard');
  };

  const handleInstallCa = useCallback(async () => {
    setCaInstalling(true);
    setCaInstallStatus('pending');
    setCaInstallError(null);
    try {
      await installPackagedCaCertificate();
      setCaInstallStatus('success');
      showSuccess('FLMルートCA証明書を登録しました');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'ルートCA証明書の登録に失敗しました';
      setCaInstallStatus('error');
      setCaInstallError(message);
      showError(message);
    } finally {
      setCaInstalling(false);
    }
  }, [showError, showSuccess]);

  const caPathHint = useMemo(() => {
    if (detectedOS === 'windows') {
      return '%APPDATA%\\flm\\certs\\flm-ca.crt';
    }
    if (detectedOS === 'macos') {
      return '~/Library/Application Support/flm/certs/flm-ca.crt';
    }
    if (detectedOS === 'linux') {
      return '~/.flm/certs/flm-ca.crt';
    }
    return '<FLMデータディレクトリ>/certs/flm-ca.crt';
  }, [detectedOS]);

  if (loading) {
    return (
      <div className="setup-wizard">
        <Breadcrumb items={breadcrumbItems} />
        <div className="loading">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="setup-wizard">
      <Breadcrumb items={breadcrumbItems} />
      <div className="page-header">
        <h1>外部公開セットアップウィザード</h1>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="wizard-container">
        <div className="wizard-steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">事前チェック</div>
          </div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">プロキシ設定</div>
          </div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">セキュリティポリシー</div>
          </div>
          <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <div className="step-label">ファイアウォール</div>
          </div>
          <div className={`step ${currentStep >= 5 ? 'active' : ''}`}>
            <div className="step-number">5</div>
            <div className="step-label">完了</div>
          </div>
        </div>

        <div className="wizard-content">
          {/* Step 1: Pre-check */}
          {currentStep === 1 && preCheckResult && (
            <div className="wizard-step">
              <h2>事前チェック</h2>
              <div className="pre-check-results">
                <div className="check-item">
                  <span className="check-label">プロキシ状態:</span>
                  <span
                    className={`check-value ${preCheckResult.proxyRunning ? 'ok' : 'error'}`}
                  >
                    {preCheckResult.proxyRunning ? '実行中' : '停止中'}
                  </span>
                </div>
                <div className="check-item">
                  <span className="check-label">APIキー:</span>
                  <span
                    className={`check-value ${preCheckResult.hasApiKeys ? 'ok' : 'error'}`}
                  >
                    {preCheckResult.hasApiKeys
                      ? `${preCheckResult.apiKeyCount}個`
                      : '未設定'}
                  </span>
                </div>
                <div className="check-item">
                  <span className="check-label">IPホワイトリスト:</span>
                  <span
                    className={`check-value ${preCheckResult.hasIpWhitelist ? 'ok' : 'warning'}`}
                  >
                    {preCheckResult.hasIpWhitelist ? '設定済み' : '未設定'}
                  </span>
                </div>
                <div className="check-item">
                  <span className="check-label">レート制限:</span>
                  <span
                    className={`check-value ${preCheckResult.hasRateLimit ? 'ok' : 'warning'}`}
                  >
                    {preCheckResult.hasRateLimit ? '設定済み' : '未設定'}
                  </span>
                </div>

                {preCheckResult.issues.length > 0 && (
                  <div className="issues-list">
                    <h3>問題:</h3>
                    <ul>
                      {preCheckResult.issues.map((issue, i) => (
                        <li key={i} className="issue-item">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preCheckResult.warnings.length > 0 && (
                  <div className="warnings-list">
                    <h3>警告:</h3>
                    <ul>
                      {preCheckResult.warnings.map((warning, i) => (
                        <li key={i} className="warning-item">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Proxy Mode & Port */}
          {currentStep === 2 && (
            <div className="wizard-step">
              <h2>プロキシ設定</h2>
              <div className="form-group">
                <label>
                  モード:
                  <select
                    value={proxyMode}
                    onChange={(e) => setProxyMode(e.target.value)}
                    className="input-select"
                  >
                    <option value="local-http">Local HTTP (開発用)</option>
                    <option value="dev-selfsigned">Dev Self-signed (開発用)</option>
                    <option value="https-acme">HTTPS ACME (推奨)</option>
                    <option value="packaged-ca">Packaged CA (パッケージ版)</option>
                  </select>
                </label>
              </div>
              <div className="form-group">
                <label>
                  ポート:
                  <input
                    type="number"
                    value={proxyPort}
                    onChange={(e) => setProxyPort(parseInt(e.target.value, 10))}
                    className="input-number"
                    min="1"
                    max="65535"
                  />
                </label>
              </div>
              <div className="form-group">
                <label>
                  Bindアドレス:
                  <input
                    type="text"
                    value={bindAddress}
                    onChange={(e) => setBindAddress(e.target.value)}
                    className="input-text"
                    placeholder="0.0.0.0"
                  />
                </label>
              </div>
              {proxyMode === 'https-acme' && (
                <>
                  <div className="form-group">
                    <label>
                      ACME Email:
                      <input
                        type="email"
                        value={acmeEmail}
                        onChange={(e) => setAcmeEmail(e.target.value)}
                        className="input-text"
                        placeholder="your@email.com"
                      />
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      ACME Domain:
                      <input
                        type="text"
                        value={acmeDomain}
                        onChange={(e) => setAcmeDomain(e.target.value)}
                        className="input-text"
                        placeholder="example.com"
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Security Policy */}
          {currentStep === 3 && (
            <div className="wizard-step">
              <h2>セキュリティポリシー</h2>
              <div className="form-group">
                <label>
                  IPホワイトリスト (1行に1つのIPまたはCIDR):
                  <textarea
                    value={ipWhitelistText}
                    onChange={(e) => {
                      setIpWhitelistText(e.target.value);
                      setIpWhitelist(
                        e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0)
                      );
                    }}
                    className="textarea"
                    rows={5}
                  />
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={corsEnabled}
                    onChange={(e) => setCorsEnabled(e.target.checked)}
                  />
                  CORSを有効化
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={rateLimitEnabled}
                    onChange={(e) => setRateLimitEnabled(e.target.checked)}
                  />
                  レート制限を有効化
                </label>
                {rateLimitEnabled && (
                  <div className="nested-form">
                    <label>
                      1分あたりのリクエスト数:
                      <input
                        type="number"
                        value={rateLimitRpm}
                        onChange={(e) => setRateLimitRpm(parseInt(e.target.value, 10))}
                        className="input-number"
                        min="1"
                      />
                    </label>
                    <label>
                      バーストサイズ:
                      <input
                        type="number"
                        value={rateLimitBurst}
                        onChange={(e) => setRateLimitBurst(parseInt(e.target.value, 10))}
                        className="input-number"
                        min="1"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Firewall */}
          {currentStep === 4 && firewallScript && (
            <div className="wizard-step">
              <h2>ファイアウォール設定</h2>
              <div className="firewall-info">
                <p>検出されたOS: <strong>{detectedOS}</strong></p>
                <p>以下のスクリプトを実行してファイアウォールを設定してください:</p>
              </div>
              <div className="ca-install-block">
                <h3>ルートCA証明書の信頼</h3>
                <p>
                  packaged-caモードではFLMのルートCA証明書をOSの信頼ストアに登録する必要があります。
                  証明書ファイルは <code>{caPathHint}</code> に配置してください。
                </p>
                <div className="ca-install-actions">
                  <button
                    className="button-primary"
                    onClick={handleInstallCa}
                    disabled={caInstalling}
                  >
                    {caInstalling ? '登録中...' : 'OS信頼ストアに登録'}
                  </button>
                  {caInstallStatus === 'success' && (
                    <span className="status success">登録済み</span>
                  )}
                  {caInstallStatus === 'error' && caInstallError && (
                    <span className="status error">{caInstallError}</span>
                  )}
                </div>
                <p className="ca-install-note">
                  権限エラーが発生した場合は管理者権限でアプリを実行するか、インストーラー同梱のスクリプトを手動で実行してください。
                </p>
              </div>
              <div className="script-preview">
                <h3>ファイアウォールスクリプト:</h3>
                <pre className="script-code">{firewallScript.script}</pre>
                <div className="script-actions">
                  <button
                    className="button-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(firewallScript.script);
                      showSuccess('スクリプトをクリップボードにコピーしました');
                    }}
                  >
                    コピー
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={firewallApplied}
                    onChange={(e) => setFirewallApplied(e.target.checked)}
                  />
                  ファイアウォールを適用済み
                </label>
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {currentStep === 5 && (
            <div className="wizard-step">
              <h2>セットアップ完了</h2>
              <div className="summary-content">
                <p>セットアップが完了しました。以下の情報を確認してください:</p>
                {finalProxyStatus?.endpoints && (
                  <div className="endpoint-info">
                    <h3>エンドポイントURL:</h3>
                    {finalProxyStatus.endpoints.localhost && (
                      <div className="endpoint-item">
                        <code>{finalProxyStatus.endpoints.localhost}</code>
                        <button
                          className="button-secondary button-small"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              finalProxyStatus.endpoints!.localhost!
                            );
                            showSuccess('URLをクリップボードにコピーしました');
                          }}
                        >
                          コピー
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="wizard-actions">
                  <button className="button-primary" onClick={handleComplete}>
                    ダッシュボードに移動
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="wizard-navigation">
            {currentStep > 1 && (
              <button className="button-secondary" onClick={handleBack}>
                戻る
              </button>
            )}
            {currentStep < 5 && (
              <button className="button-primary" onClick={handleNext}>
                次へ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

