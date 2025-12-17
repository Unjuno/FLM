// Formatting utility functions

/**
 * Get current locale from localStorage or default to 'ja'
 */
function getCurrentLocale(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('locale');
      if (stored === 'en' || stored === 'ja') {
        return stored;
      }
      // Fallback to navigator language
      const navLang = navigator.language.toLowerCase();
      if (navLang.startsWith('en')) {
        return 'en';
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  return 'ja';
}

/**
 * Get locale string for Intl API
 */
function getLocaleString(locale?: string): string {
  const currentLocale = locale || getCurrentLocale();
  const localeMap: { [key: string]: string } = {
    ja: 'ja-JP',
    en: 'en-US',
  };
  return localeMap[currentLocale] || 'ja-JP';
}

/**
 * Get "Unknown" text based on locale
 */
function getUnknownText(locale?: string): string {
  const currentLocale = locale || getCurrentLocale();
  return currentLocale === 'en' ? 'Unknown' : '不明';
}

/**
 * Formats date and time to locale-specific string
 * @param dateString - ISO date string
 * @param locale - Optional locale override ('ja' or 'en')
 */
export const formatDateTime = (dateString: string, locale?: string): string => {
  if (!dateString || dateString.trim() === '') {
    return getUnknownText(locale);
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const targetLocale = getLocaleString(locale);
    return date.toLocaleString(targetLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateString;
  }
};

/**
 * Formats date only (without time) to locale-specific string
 * @param dateString - ISO date string
 * @param locale - Optional locale override ('ja' or 'en')
 */
export const formatDate = (dateString: string, locale?: string): string => {
  if (!dateString || dateString.trim() === '') {
    return getUnknownText(locale);
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const targetLocale = getLocaleString(locale);
    return date.toLocaleDateString(targetLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateString;
  }
};

/**
 * Formats ProxyMode enum to human-readable string
 */
export const formatProxyMode = (
  mode: string | { [key: string]: unknown }
): string => {
  if (typeof mode === 'string') {
    // Handle kebab-case format from serde
    const modeMap: { [key: string]: string } = {
      'local-http': 'Local HTTP',
      'dev-selfsigned': 'Dev Self-Signed',
      'dev-self-signed': 'Dev Self-Signed', // Backward compatibility
      'https-acme': 'HTTPS ACME',
      'packaged-ca': 'Packaged CA',
    };
    return modeMap[mode] || mode;
  }
  // ProxyMode enum can be: "LocalHttp", "DevSelfSigned", "HttpsAcme", "PackagedCa"
  if (mode && typeof mode === 'object') {
    if ('LocalHttp' in mode || 'local-http' in mode) return 'Local HTTP';
    if (
      'DevSelfSigned' in mode ||
      'dev-selfsigned' in mode ||
      'dev-self-signed' in mode
    )
      return 'Dev Self-Signed';
    if ('HttpsAcme' in mode || 'https-acme' in mode) return 'HTTPS ACME';
    if ('PackagedCa' in mode || 'packaged-ca' in mode) return 'Packaged CA';
    // Fallback to JSON stringify
    return JSON.stringify(mode);
  }
  return 'Unknown';
};

/**
 * Formats EngineStatus enum to human-readable string
 */
export const formatEngineStatus = (
  status: string | { [key: string]: unknown } | unknown
): string => {
  if (typeof status === 'string') {
    // Handle kebab-case format from serde
    const statusMap: { [key: string]: string } = {
      'installed-only': 'Installed Only',
      'running-healthy': 'Running Healthy',
      'running-degraded': 'Running Degraded',
      'error-network': 'Network Error',
      'error-api': 'API Error',
    };
    return (
      statusMap[status] ||
      status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    );
  }
  // EngineStatus enum can be: "InstalledOnly", "RunningHealthy", "RunningDegraded", "ErrorNetwork", "ErrorApi"
  if (status && typeof status === 'object') {
    const statusObj = status as Record<string, unknown>;
    // Check for enum variants (tagged enum format: { "status": "running-healthy", "latency_ms": 100 })
    if ('status' in statusObj) {
      const statusValue = statusObj.status;
      if (typeof statusValue === 'string') {
        const latency =
          typeof statusObj.latency_ms === 'number'
            ? statusObj.latency_ms
            : undefined;
        const reason =
          typeof statusObj.reason === 'string' ? statusObj.reason : undefined;
        const statusMap: { [key: string]: string } = {
          'installed-only': 'Installed Only',
          'running-healthy': `Running Healthy${latency ? ` (${latency}ms)` : ''}`,
          'running-degraded': `Running Degraded${latency ? ` (${latency}ms)` : ''}${reason ? `: ${reason}` : ''}`,
          'error-network': `Network Error${reason ? `: ${reason}` : ''}`,
          'error-api': `API Error${reason ? `: ${reason}` : ''}`,
        };
        return (
          statusMap[statusValue] ||
          statusValue.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        );
      }
    }
    // Check for direct enum variants (untagged format)
    if ('InstalledOnly' in statusObj || 'installed-only' in statusObj)
      return 'Installed Only';
    if ('RunningHealthy' in statusObj || 'running-healthy' in statusObj) {
      const runningHealthy = (statusObj.RunningHealthy ||
        statusObj['running-healthy'] ||
        statusObj) as Record<string, unknown>;
      const latency =
        typeof runningHealthy.latency_ms === 'number'
          ? runningHealthy.latency_ms
          : undefined;
      return `Running Healthy${latency ? ` (${latency}ms)` : ''}`;
    }
    if ('RunningDegraded' in statusObj || 'running-degraded' in statusObj) {
      const runningDegraded = (statusObj.RunningDegraded ||
        statusObj['running-degraded'] ||
        statusObj) as Record<string, unknown>;
      const latency =
        typeof runningDegraded.latency_ms === 'number'
          ? runningDegraded.latency_ms
          : undefined;
      const reason =
        typeof runningDegraded.reason === 'string'
          ? runningDegraded.reason
          : undefined;
      return `Running Degraded${latency ? ` (${latency}ms)` : ''}${reason ? `: ${reason}` : ''}`;
    }
    if ('ErrorNetwork' in statusObj || 'error-network' in statusObj) {
      const errorNetwork = (statusObj.ErrorNetwork ||
        statusObj['error-network'] ||
        statusObj) as Record<string, unknown>;
      const reason =
        typeof errorNetwork.reason === 'string'
          ? errorNetwork.reason
          : undefined;
      return `Network Error${reason ? `: ${reason}` : ''}`;
    }
    if ('ErrorApi' in statusObj || 'error-api' in statusObj) {
      const errorApi = (statusObj.ErrorApi ||
        statusObj['error-api'] ||
        statusObj) as Record<string, unknown>;
      const reason =
        typeof errorApi.reason === 'string' ? errorApi.reason : undefined;
      return `API Error${reason ? `: ${reason}` : ''}`;
    }
    // Fallback to JSON stringify
    return JSON.stringify(status);
  }
  return 'Unknown';
};
