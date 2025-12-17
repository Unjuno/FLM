// Security Events visualization page

import React, { useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { AuditLogsView } from '../components/security/AuditLogsView';
import { IntrusionEventsView } from '../components/security/IntrusionEventsView';
import { AnomalyEventsView } from '../components/security/AnomalyEventsView';
import './SecurityEvents.css';

type TabType = 'audit' | 'intrusion' | 'anomaly';

export const SecurityEvents: React.FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>('audit');

  return (
    <div className="security-events">
      <div className="page-header">
        <h1>{t('security.title')}</h1>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          {t('security.auditLogs')}
        </button>
        <button
          className={`tab ${activeTab === 'intrusion' ? 'active' : ''}`}
          onClick={() => setActiveTab('intrusion')}
        >
          {t('security.intrusionDetection')}
        </button>
        <button
          className={`tab ${activeTab === 'anomaly' ? 'active' : ''}`}
          onClick={() => setActiveTab('anomaly')}
        >
          {t('security.anomalyDetection')}
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'audit' && <AuditLogsView />}
        {activeTab === 'intrusion' && <IntrusionEventsView />}
        {activeTab === 'anomaly' && <AnomalyEventsView />}
      </div>
    </div>
  );
};
