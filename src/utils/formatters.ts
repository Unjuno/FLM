// Formatting utility functions

/**
 * Formats date and time to Japanese locale string
 */
export const formatDateTime = (dateString: string): string => {
  if (!dateString || dateString.trim() === '') {
    return '不明';
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleString('ja-JP', {
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
 * Formats date only (without time) to Japanese locale string
 */
export const formatDate = (dateString: string): string => {
  if (!dateString || dateString.trim() === '') {
    return '不明';
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString('ja-JP', {
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
export const formatProxyMode = (mode: string | { [key: string]: any }): string => {
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
    if ('DevSelfSigned' in mode || 'dev-selfsigned' in mode || 'dev-self-signed' in mode) return 'Dev Self-Signed';
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
export const formatEngineStatus = (status: string | { [key: string]: any }): string => {
  if (typeof status === 'string') {
    // Handle kebab-case format from serde
    const statusMap: { [key: string]: string } = {
      'installed-only': 'Installed Only',
      'running-healthy': 'Running Healthy',
      'running-degraded': 'Running Degraded',
      'error-network': 'Network Error',
      'error-api': 'API Error',
    };
    return statusMap[status] || status.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
  // EngineStatus enum can be: "InstalledOnly", "RunningHealthy", "RunningDegraded", "ErrorNetwork", "ErrorApi"
  if (status && typeof status === 'object') {
    // Check for enum variants (tagged enum format: { "status": "running-healthy", "latency_ms": 100 })
    if ('status' in status) {
      const statusValue = status.status;
      if (typeof statusValue === 'string') {
        const statusMap: { [key: string]: string } = {
          'installed-only': 'Installed Only',
          'running-healthy': `Running Healthy${status.latency_ms ? ` (${status.latency_ms}ms)` : ''}`,
          'running-degraded': `Running Degraded${status.latency_ms ? ` (${status.latency_ms}ms)` : ''}`,
          'error-network': `Network Error${status.reason ? `: ${status.reason}` : ''}`,
          'error-api': `API Error${status.reason ? `: ${status.reason}` : ''}`,
        };
        return statusMap[statusValue] || statusValue.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      }
    }
    // Check for direct enum variants (untagged format)
    if ('InstalledOnly' in status || 'installed-only' in status) return 'Installed Only';
    if ('RunningHealthy' in status || 'running-healthy' in status) {
      const latency = status.RunningHealthy?.latency_ms || status['running-healthy']?.latency_ms || status.latency_ms;
      return `Running Healthy${latency ? ` (${latency}ms)` : ''}`;
    }
    if ('RunningDegraded' in status || 'running-degraded' in status) {
      const info = status.RunningDegraded || status['running-degraded'];
      const latency = info?.latency_ms || status.latency_ms;
      const reason = info?.reason || status.reason;
      return `Running Degraded${latency ? ` (${latency}ms)` : ''}${reason ? `: ${reason}` : ''}`;
    }
    if ('ErrorNetwork' in status || 'error-network' in status) {
      const reason = status.ErrorNetwork?.reason || status['error-network']?.reason || status.reason;
      return `Network Error${reason ? `: ${reason}` : ''}`;
    }
    if ('ErrorApi' in status || 'error-api' in status) {
      const reason = status.ErrorApi?.reason || status['error-api']?.reason || status.reason;
      return `API Error${reason ? `: ${reason}` : ''}`;
    }
    // Fallback to JSON stringify
    return JSON.stringify(status);
  }
  return 'Unknown';
};
