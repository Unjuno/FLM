// SPDX-License-Identifier: MIT
// setupWizard - Setup Wizard services for external publish setup

import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';
import {
  fetchProxyStatus,
  fetchSecurityAlerts,
  ProxyStatus,
  SecurityAlert,
} from './dashboard';
import { fetchApiKeys, ApiKey } from './apiSetup';
import { fetchSecurityPolicy, SecurityPolicy } from './apiSetup';

// Pre-check result
export interface PreCheckResult {
  proxyRunning: boolean;
  proxyMode?: string;
  hasApiKeys: boolean;
  apiKeyCount: number;
  hasIpWhitelist: boolean;
  hasRateLimit: boolean;
  issues: string[];
  warnings: string[];
}

export async function performPreCheck(): Promise<PreCheckResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  const [proxyStatus, securityAlerts, apiKeys, securityPolicy] = await Promise.all([
    fetchProxyStatus(),
    fetchSecurityAlerts(),
    fetchApiKeys(),
    fetchSecurityPolicy(),
  ]);

  const proxyRunning = proxyStatus?.running ?? false;
  const proxyMode = proxyStatus?.mode;
  const hasApiKeys = securityAlerts?.apiKeyCount > 0;
  const apiKeyCount = securityAlerts?.apiKeyCount ?? 0;
  const hasIpWhitelist = securityAlerts?.hasIpWhitelist ?? false;
  const hasRateLimit = securityAlerts?.hasRateLimit ?? false;

  if (!proxyRunning) {
    issues.push('プロキシが実行されていません');
  } else if (proxyMode === 'local-http') {
    warnings.push('プロキシがローカルHTTPモードで実行されています。外部公開にはHTTPSが必要です');
  }

  if (!hasApiKeys) {
    issues.push('APIキーが設定されていません');
  }

  if (!hasIpWhitelist) {
    warnings.push('IPホワイトリストが設定されていません。すべてのIPからアクセス可能です');
  }

  if (!hasRateLimit) {
    warnings.push('レート制限が設定されていません');
  }

  return {
    proxyRunning,
    proxyMode,
    hasApiKeys,
    apiKeyCount,
    hasIpWhitelist,
    hasRateLimit,
    issues,
    warnings,
  };
}

// Detect OS type
export async function detectOS(): Promise<'windows' | 'macos' | 'linux' | 'unknown'> {
  try {
    const platform = await safeInvoke<{ platform: string }>('get_platform');
    const platformStr = platform?.platform?.toLowerCase() || '';
    
    if (platformStr.includes('win')) {
      return 'windows';
    } else if (platformStr.includes('mac') || platformStr.includes('darwin')) {
      return 'macos';
    } else if (platformStr.includes('linux')) {
      return 'linux';
    }
    return 'unknown';
  } catch (err) {
    logger.warn('SetupWizard: failed to detect OS', err, 'SetupWizard');
    // Fallback to navigator.platform
    if (typeof navigator !== 'undefined') {
      const navPlatform = navigator.platform.toLowerCase();
      if (navPlatform.includes('win')) {
        return 'windows';
      } else if (navPlatform.includes('mac')) {
        return 'macos';
      } else if (navPlatform.includes('linux') || navPlatform.includes('x11')) {
        return 'linux';
      }
    }
    return 'unknown';
  }
}

// Generate firewall script
export interface FirewallScript {
  script: string;
  shell: string;
  rollbackScript: string;
}

export async function generateFirewallScript(
  ports: number[],
  allowedIps: string[],
  os: 'windows' | 'macos' | 'linux' | 'unknown'
): Promise<FirewallScript> {
  let script = '';
  let shell = '';
  let rollbackScript = '';

  if (os === 'windows') {
    shell = 'powershell';
    script = '# Windows Firewall Rules\n';
    script += '# Run as Administrator\n\n';

    for (const port of ports) {
      script += `# Allow port ${port}\n`;
      script += `New-NetFirewallRule -DisplayName "FLM Proxy ${port}" -Direction Inbound -LocalPort ${port} -Protocol TCP -Action Allow\n`;
      
      if (allowedIps.length > 0) {
        script += `# Restrict to specific IPs\n`;
        for (const ip of allowedIps) {
          script += `New-NetFirewallRule -DisplayName "FLM Proxy ${port} - ${ip}" -Direction Inbound -LocalPort ${port} -Protocol TCP -RemoteAddress ${ip} -Action Allow\n`;
        }
      }
      script += '\n';
    }

    rollbackScript = '# Rollback: Remove FLM Firewall Rules\n';
    rollbackScript += 'Get-NetFirewallRule -DisplayName "FLM Proxy*" | Remove-NetFirewallRule\n';
  } else if (os === 'macos') {
    shell = 'bash';
    script = '#!/bin/bash\n';
    script += '# macOS Firewall Rules (pfctl)\n';
    script += '# Run with sudo\n\n';

    script += 'PFCTL="/sbin/pfctl"\n';
    script += 'ANCHOR="flm-proxy"\n\n';

    script += '# Create anchor\n';
    script += `$PFCTL -a $ANCHOR -f /dev/stdin <<EOF\n`;

    for (const port of ports) {
      script += `pass in on any proto tcp to any port ${port}`;
      if (allowedIps.length > 0) {
        script += ` from { ${allowedIps.join(' ')} }`;
      }
      script += '\n';
    }

    script += 'EOF\n\n';
    script += '# Load rules\n';
    script += `$PFCTL -a $ANCHOR -f /dev/stdin\n`;

    rollbackScript = '#!/bin/bash\n';
    rollbackScript += '# Rollback: Remove FLM Firewall Rules\n';
    rollbackScript += '/sbin/pfctl -a flm-proxy -F all\n';
  } else if (os === 'linux') {
    shell = 'bash';
    script = '#!/bin/bash\n';
    script += '# Linux Firewall Rules (ufw/firewalld)\n';
    script += '# Run with sudo\n\n';

    script += '# Detect firewall type\n';
    script += 'if command -v ufw > /dev/null 2>&1; then\n';
    script += '  # UFW\n';
    for (const port of ports) {
      if (allowedIps.length > 0) {
        for (const ip of allowedIps) {
          script += `  ufw allow from ${ip} to any port ${port}\n`;
        }
      } else {
        script += `  ufw allow ${port}/tcp\n`;
      }
    }
    script += 'elif command -v firewall-cmd > /dev/null 2>&1; then\n';
    script += '  # firewalld\n';
    for (const port of ports) {
      script += `  firewall-cmd --permanent --add-port=${port}/tcp\n`;
      if (allowedIps.length > 0) {
        script += `  firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='${allowedIps[0]}' port port='${port}' protocol='tcp' accept"\n`;
      }
    }
    script += '  firewall-cmd --reload\n';
    script += 'fi\n';

    rollbackScript = '#!/bin/bash\n';
    rollbackScript += '# Rollback: Remove FLM Firewall Rules\n';
    rollbackScript += 'if command -v ufw > /dev/null 2>&1; then\n';
    for (const port of ports) {
      rollbackScript += `  ufw delete allow ${port}/tcp\n`;
    }
    rollbackScript += 'elif command -v firewall-cmd > /dev/null 2>&1; then\n';
    for (const port of ports) {
      rollbackScript += `  firewall-cmd --permanent --remove-port=${port}/tcp\n`;
    }
    rollbackScript += '  firewall-cmd --reload\n';
    rollbackScript += 'fi\n';
  } else {
    script = '# Unknown OS - Manual configuration required\n';
    rollbackScript = '# Rollback script not available\n';
  }

  return { script, shell, rollbackScript };
}

export async function installPackagedCaCertificate(): Promise<void> {
  await safeInvoke('ipc_security_install_packaged_ca');
}

// Validate IP whitelist (check for RFC1918/localhost only)
export function validateIpWhitelist(ips: string[]): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const rfc1918Patterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fe80:/,
    /^fc00:/,
    /^fd00:/,
  ];

  let hasPublicIp = false;
  for (const ip of ips) {
    const isPrivate = rfc1918Patterns.some((pattern) => pattern.test(ip));
    if (!isPrivate) {
      hasPublicIp = true;
      break;
    }
  }

  if (!hasPublicIp && ips.length > 0) {
    warnings.push(
      'IPホワイトリストに公開IPが含まれていません。外部アクセスには公開IPの追加が必要です'
    );
  }

  return {
    isValid: true,
    warnings,
  };
}

