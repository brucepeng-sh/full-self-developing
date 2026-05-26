import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';
import { Search, Eye, EyeOff, Menu, X, Plus } from 'lucide-react';
import { getToken, apiFetch } from '../api';

// Form Components
const SectionTitle = ({ children }) => (
  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">{children}</h3>
);

const Description = ({ children }) => (
  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{children}</p>
);

const Row = ({ label, description, children, noBorder, badge }) => (
  <div className={`flex items-center justify-between py-4 ${noBorder ? '' : 'border-b border-gray-100 dark:border-zinc-800'} last:border-0 last:pb-0 last:pt-4`}>
    <div className="flex-1 pr-4">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
        {badge}
      </div>
      {description && <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>}
    </div>
    <div className="flex-shrink-0">
      {children}
    </div>
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
    />
  </button>
);

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="h-9 block w-48 rounded-md border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-gray-100 px-3 py-1"
  >
    {options.map((opt) => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
);

const Input = ({ type = "text", value, onChange, className = "w-48" }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`h-9 block rounded-md border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-gray-100 px-3 py-1 ${className}`}
  />
);

const PasswordInput = ({ value, onChange, className = "w-48" }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 block rounded-md border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-gray-100 px-3 py-1 pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const Textarea = ({ value, onChange, className = "w-full", rows = 3 }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    rows={rows}
    className={`block rounded-md border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-gray-100 p-3 ${className}`}
  />
);

const Button = ({ children, onClick, variant = 'primary', className = '' }) => {
  const baseStyle = "h-9 px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "text-white bg-blue-600 hover:bg-blue-700",
    secondary: "text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700",
    danger: "text-white bg-red-600 hover:bg-red-700",
    ghost: "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const SystemStatusDashboard = ({ serverConnected }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      const data = await apiFetch('/api/system/status');
      setStatus(data);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <div className="animate-pulse text-sm">Loading system diagnostics...</div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-400 p-6 rounded-lg border border-red-200 dark:border-red-900/30">
        <h4 className="font-semibold mb-2 text-sm">Failed to connect to diagnostics API</h4>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  const recentErrors = status?.recentErrors || [];
  const engineInfo = status?.engine || {};

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">Engine Status</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${serverConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-lg font-bold text-gray-900 dark:text-white capitalize">{engineInfo.status || 'Offline'}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Active Engine: {engineInfo.currentEngine || 'None'}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">Requests (RPM)</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{status?.rpm || 0}</div>
          <div className="w-full bg-gray-100 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${Math.min(100, (status?.rpm || 0) * 5)}%` }} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">Error Count (Last 20)</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{recentErrors.length}</div>
          <div className="text-xs text-gray-500 mt-1">Telemetry active</div>
        </div>
      </div>

      {/* Active Model / Settings Info */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Engine Configurations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-650 dark:text-gray-300">
          <div>
            <span className="text-gray-400">Current Model:</span>{' '}
            <span className="font-mono font-medium text-gray-900 dark:text-white">{engineInfo.currentModel || 'Not Configured'}</span>
          </div>
          <div>
            <span className="text-gray-400">Memory Registry Size:</span>{' '}
            <span className="font-medium text-gray-900 dark:text-white">{status?.loop?.tasksCount || 0} tasks</span>
          </div>
          <div>
            <span className="text-gray-400">Workspace Connected:</span>{' '}
            <span className="font-medium text-gray-900 dark:text-white">{status?.workspace?.path ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span className="text-gray-400">API Endpoint:</span>{' '}
            <span className="font-mono text-xs">{window.location.origin}</span>
          </div>
        </div>
      </div>

      {/* Recent Errors Section */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-gray-200 dark:border-zinc-800 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent Error Logs</h3>
        {recentErrors.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">No errors recorded in the system status queue.</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {recentErrors.map((err, idx) => (
              <div key={idx} className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/20 rounded-md text-xs font-mono">
                <div className="flex justify-between text-red-750 dark:text-red-400 font-semibold mb-1">
                  <span>{err.code || 'ERROR'} ({err.status || 550})</span>
                  <span className="text-gray-400 dark:text-zinc-500 font-normal">{new Date(err.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-gray-700 dark:text-gray-300 break-words">{err.message}</div>
                {err.path && <div className="text-gray-450 mt-1">Path: {err.path}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Panel Component
export default function SettingsPanel({ defaultTab = 'ui' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, updateSetting, updateSettingsBatch, serverConnected, workspaceConnected, skills, toggleSkill, createSkill } = useSettings();
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [advancedAiOpen, setAdvancedAiOpen] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [modelsResult, setModelsResult] = useState(null);
  const [modelsList, setModelsList] = useState([]);
  const [hasTestedConnection, setHasTestedConnection] = useState(false);
  const [showCreateSkillModal, setShowCreateSkillModal] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');

  const [mcpServers, setMcpServers] = useState([]);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [mcpForm, setMcpForm] = useState({ name: '', command: '', args: '', env: '' });

  const fetchMcpServers = async () => {
    try {
      const res = await apiFetch('/api/mcp/servers');
      if (res && res.servers) {
        setMcpServers(res.servers);
      }
    } catch (err) {
      console.error('Failed to fetch MCP servers', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'mcp') {
      fetchMcpServers();
    }
  }, [activeTab]);

  const handleAddMcpServer = async () => {
    if (!mcpForm.name || !mcpForm.command) return;
    try {
      let parsedArgs = [];
      if (mcpForm.args) {
        parsedArgs = mcpForm.args.split(' ').filter(a => a.trim() !== '');
      }
      let parsedEnv = {};
      if (mcpForm.env) {
        mcpForm.env.split('\n').forEach(line => {
          const [k, v] = line.split('=');
          if (k && v) parsedEnv[k.trim()] = v.trim();
        });
      }
      await apiFetch('/api/mcp/connect', {
        method: 'POST',
        body: JSON.stringify({ name: mcpForm.name, command: mcpForm.command, args: parsedArgs, env: Object.keys(parsedEnv).length > 0 ? parsedEnv : undefined })
      });
      setShowAddMcpModal(false);
      setMcpForm({ name: '', command: '', args: '', env: '' });
      fetchMcpServers();
    } catch (err) {
      alert('Failed to add MCP server: ' + err.message);
    }
  };

  const handleRemoveMcpServer = async (name) => {
    try {
      await apiFetch('/api/mcp/disconnect', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      fetchMcpServers();
    } catch (err) {
      alert('Failed to remove MCP server: ' + err.message);
    }
  };
  
  const handleCreateSkill = async () => {
    if (!newSkillName || !newSkillDesc) return;
    const success = await createSkill(newSkillName, newSkillDesc);
    if (success) {
      setShowCreateSkillModal(false);
      setNewSkillName('');
      setNewSkillDesc('');
    }
  };

  const getStatusBadge = () => null;

  const handleTestConnection = async () => {
    setHasTestedConnection(true);
    setTestResult({ type: 'info', msg: 'Testing connection...' });
    try {
      const data = await apiFetch('/api/ai/test-connection', {
        method: 'POST',
        body: JSON.stringify(settings.ai)
      });
      if (data.success) {
        setTestResult({ type: 'success', msg: data.message });
        updateSettingsBatch(settings);
        handleRefreshModels();
      } else {
        setTestResult({ type: 'error', msg: data.error });
      }
    } catch (err) {
      setTestResult({ type: 'error', msg: err.message });
    }
  };

  const handleRefreshModels = async () => {
    setModelsResult({ type: 'info', msg: 'Fetching models (async)...' });
    try {
      const data = await apiFetch('/api/ai/models', {
        method: 'POST',
        body: JSON.stringify(settings.ai)
      });
      if (data.success) {
        if (data.models && data.models.length > 0) {
           setModelsList(data.models);
           if (!settings.ai.model || !data.models.includes(settings.ai.model)) {
             updateSetting('ai', 'model', data.models[0]);
           }
           setModelsResult({ type: 'success', msg: `Found ${data.models.length} models.` });
        } else {
           setModelsList([]);
           setModelsResult({ type: 'warning', msg: '⚠️ No models found.' });
        }
      } else {
        setModelsList([]);
        setModelsResult({ type: 'error', msg: `⚠️ ${data.error}` });
      }
    } catch (err) {
      setModelsList([]);
      setModelsResult({ type: 'error', msg: `⚠️ ${err.message}` });
    }
  };

  const handleTestModel = async () => {
    setModelsResult({ type: 'info', msg: 'Testing model with "Hello"...' });
    try {
      const data = await apiFetch('/api/ai/test-model', {
        method: 'POST',
        body: JSON.stringify(settings.ai)
      });
      if (data.success) {
        setModelsResult({ type: 'success', msg: `Success: ${data.reply.substring(0, 50)}` });
        updateSettingsBatch(settings);
      } else {
        setModelsResult({ type: 'error', msg: `⚠️ ${data.error}` });
      }
    } catch (err) {
      setModelsResult({ type: 'error', msg: `⚠️ ${err.message}` });
    }
  };

  useEffect(() => {
    if (settings.ai.executionMode === 'Local CLI Driver') {
      const validCliProviders = ['gemini-cli', 'claude-cli', 'opencode', 'codex', 'openshell', 'tts-local-cli', 'skill-workshop'];
      if (!validCliProviders.includes(settings.ai.provider)) {
        updateSetting('ai', 'provider', 'gemini-cli');
        return; // Will re-trigger after the setting updates
      }
      handleRefreshModels();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.ai.provider, settings.ai.executionMode]);

  const menuGroups = [
    {
      title: t('settings.general'),
      items: [
        { id: 'ui', label: t('settings.tabs.ui') },
        { id: 'fsd', label: t('settings.tabs.fsd') },
        { id: 'memory', label: t('settings.tabs.memory') },
        { id: 'safety', label: t('settings.tabs.safety') }
      ]
    },
    {
      title: t('settings.agentCapabilities'),
      items: [
        { id: 'ai', label: t('settings.tabs.ai') },
        { id: 'mcp', label: t('settings.tabs.mcp') },
        { id: 'skills', label: t('settings.tabs.skills') }
      ]
    },
    {
      title: t('settings.system'),
      items: [
        { id: 'status', label: 'System Status / 系统状态' },
        { id: 'integrations', label: t('settings.tabs.integrations') },
        { id: 'advanced', label: t('settings.tabs.advanced') }
      ]
    }
  ];

  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
  })).filter(group => group.items.length > 0);

  const renderContent = () => {
    switch (activeTab) {
      case 'status':
        return <SystemStatusDashboard serverConnected={serverConnected} />;
      case 'ui':
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div>
                <SectionTitle>{t('settings.ui.title')}</SectionTitle>
                <Description>{t('settings.ui.description')}</Description>
              </div>
              {getStatusBadge(true)}
            </div>
            <Row label={t('settings.ui.theme')} badge={getStatusBadge(true)}>
              <Select value={settings.ui.theme} onChange={(v) => updateSetting('ui', 'theme', v)} options={['Light', 'Dark', 'System']} />
            </Row>
            <Row label={t('settings.ui.language')} badge={getStatusBadge(true)} noBorder>
              <Select value={settings.ui.language} onChange={(v) => updateSetting('ui', 'language', v)} options={['English', '中文 (简体)', '日本語', '한국어', 'Español']} />
            </Row>
          </div>
        );
      case 'fsd':
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div>
                <SectionTitle>{t('settings.fsd.title')}</SectionTitle>
                <Description>{t('settings.fsd.description')}</Description>
              </div>
              {getStatusBadge(false)}
            </div>
            <Row label={t('settings.fsd.reviewRounds')} badge={getStatusBadge(false)}>
              <Input type="number" value={settings.fsd.reviewRounds} onChange={(v) => updateSetting('fsd', 'reviewRounds', Number(v))} className="w-24" />
            </Row>
            <Row label={t('settings.fsd.concurrency')} badge={getStatusBadge(false)}>
              <Input type="number" value={settings.fsd.concurrency} onChange={(v) => updateSetting('fsd', 'concurrency', Number(v))} className="w-24" />
            </Row>
            <Row label={t('settings.fsd.manualConfirm')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.fsd.manualConfirm} onChange={(v) => updateSetting('fsd', 'manualConfirm', v)} />
            </Row>
            <Row label={t('settings.fsd.taskPriority')} badge={getStatusBadge(false)}>
              <Select value={settings.fsd.taskPriority} onChange={(v) => updateSetting('fsd', 'taskPriority', v)} options={['Low', 'Normal', 'High']} />
            </Row>
            <Row label={t('settings.fsd.autoRunTests')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.fsd.autoRunTests} onChange={(v) => updateSetting('fsd', 'autoRunTests', v)} />
            </Row>
            <Row label={t('settings.fsd.requireApproval')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.fsd.requireApproval} onChange={(v) => updateSetting('fsd', 'requireApproval', v)} />
            </Row>
            <Row label={t('settings.fsd.ignoredPaths')} badge={getStatusBadge(false)} noBorder>
              <div className="w-full mt-2">
                <Textarea value={settings.fsd.ignoredPaths} onChange={(v) => updateSetting('fsd', 'ignoredPaths', v)} rows={4} />
              </div>
            </Row>
          </div>
        );
      case 'memory':
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div>
                <SectionTitle>{t('settings.memory.title')}</SectionTitle>
                <Description>{t('settings.memory.description')}</Description>
              </div>
              {getStatusBadge(false)}
            </div>
            <Row label={t('settings.memory.enabled')} description={t('settings.memory.enabledDesc')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.memory.enabled} onChange={(v) => updateSetting('memory', 'enabled', v)} />
            </Row>
            <Row label={t('settings.memory.compression')} description={t('settings.memory.compressionDesc')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.memory.compression} onChange={(v) => updateSetting('memory', 'compression', v)} />
            </Row>
            <Row label={t('settings.memory.dedupeThreshold')} description={t('settings.memory.dedupeThresholdDesc')} badge={getStatusBadge(false)} noBorder>
              <Input type="number" step="0.05" min="0" max="1" value={settings.memory.dedupeThreshold} onChange={(v) => updateSetting('memory', 'dedupeThreshold', Number(v))} className="w-24" />
            </Row>
          </div>
        );
      case 'safety':
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div>
                <SectionTitle>{t('settings.safety.title')}</SectionTitle>
                <Description>{t('settings.safety.description')}</Description>
              </div>
              {getStatusBadge(false)}
            </div>
            <Row label={t('settings.safety.confirmDestructive')} description={t('settings.safety.confirmDestructiveDesc')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.safety.confirmDestructive} onChange={(v) => updateSetting('safety', 'confirmDestructive', v)} />
            </Row>
            <Row label={t('settings.safety.confirmStopAll')} description={t('settings.safety.confirmStopAllDesc')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.safety.confirmStopAll} onChange={(v) => updateSetting('safety', 'confirmStopAll', v)} />
            </Row>
            <Row label={t('settings.safety.networkAccess')} description={t('settings.safety.networkAccessDesc')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.safety.networkAccess} onChange={(v) => updateSetting('safety', 'networkAccess', v)} />
            </Row>
            <Row label={t('settings.safety.externalUrlAccess')} description={t('settings.safety.externalUrlAccessDesc')} badge={getStatusBadge(false)} noBorder>
              <Toggle checked={settings.safety.externalUrlAccess} onChange={(v) => updateSetting('safety', 'externalUrlAccess', v)} />
            </Row>
          </div>
        );
      case 'ai':
        const isCliMode = settings.ai.executionMode === 'Local CLI Driver';
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div>
                <SectionTitle>{t('settings.ai.title')}</SectionTitle>
                <Description>{t('settings.ai.description')}</Description>
              </div>
              {getStatusBadge(false)}
            </div>
            
            <Row label={t('settings.ai.executionMode')} badge={getStatusBadge(false)}>
              <Select 
                value={settings.ai.executionMode || 'HTTP API'} 
                onChange={(v) => {
                  updateSettingsBatch({
                    ...settings,
                    ai: {
                      ...settings.ai,
                      executionMode: v,
                      provider: v === 'Local CLI Driver' ? 'gemini-cli' : 'OpenRouter'
                    }
                  });
                }} 
                options={['HTTP API', 'Local CLI Driver']} 
              />
            </Row>

            <Row label={t('settings.ai.provider')} badge={getStatusBadge(false)}>
              <select
                value={settings.ai.provider}
                onChange={(e) => updateSetting('ai', 'provider', e.target.value)}
                className="h-9 block w-48 rounded-md border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-gray-100 px-3 py-1"
              >
                {!isCliMode ? (
                  <>
                    <optgroup label="Global Ecosystem">
                      {['OpenAI', 'Anthropic', 'Google', 'Microsoft (Azure)', 'Amazon Bedrock', 'xAI', 'Mistral', 'Groq', 'Perplexity', 'HuggingFace', 'Cohere (Voyage)', 'NVIDIA', 'GitHub Copilot'].map(o => <option key={o} value={o}>{o}</option>)}
                    </optgroup>
                    <optgroup label="Aggregators">
                      {['OpenRouter', 'LiteLLM', 'Cloudflare AI Gateway', 'Vercel AI Gateway'].map(o => <option key={o} value={o}>{o}</option>)}
                    </optgroup>
                    <optgroup label="Chinese Ecosystem">
                      {['DeepSeek', 'Alibaba (Qwen)', 'Tencent (Hunyuan)', 'Baidu (Qianfan)', 'ByteDance (Volcengine/Doubao)', 'Moonshot (Kimi)', 'Minimax', 'StepFun'].map(o => <option key={o} value={o}>{o}</option>)}
                    </optgroup>
                    <optgroup label="Local & Cloud Compute">
                      {['Ollama', 'LMStudio', 'vLLM', 'sglang', 'cerebras', 'deepinfra', 'fireworks', 'together', 'arcee', 'chutes', 'venice'].map(o => <option key={o} value={o}>{o}</option>)}
                    </optgroup>
                    <optgroup label="Voice, Image & Multi-modal">
                      {['ElevenLabs', 'Deepgram', 'SenseAudio', 'Runway', 'Fal', 'Comfy'].map(o => <option key={o} value={o}>{o}</option>)}
                    </optgroup>
                  </>
                ) : (
                  <optgroup label="Supported CLI Drivers">
                    {['gemini-cli', 'claude-cli', 'opencode', 'codex', 'openshell', 'tts-local-cli', 'skill-workshop'].map(o => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                )}
              </select>
            </Row>

            {!isCliMode && (
              <>
                <Row label={t('settings.ai.apiKey')} badge={getStatusBadge(false)}>
                  <PasswordInput value={settings.ai.apiKey} onChange={(v) => updateSetting('ai', 'apiKey', v)} className="w-64" />
                </Row>
                <Row label={t('settings.ai.baseUrl')} badge={getStatusBadge(false)}>
                  <Input value={settings.ai.baseUrl} onChange={(v) => updateSetting('ai', 'baseUrl', v)} className="w-64" />
                </Row>
              </>
            )}

            <Row label="" badge={getStatusBadge(false)}>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleTestConnection}>{t('settings.ai.testConnection')}</Button>
                {testResult && <span className={`text-sm ${testResult.type === 'error' ? 'text-red-500' : testResult.type === 'success' ? 'text-green-500' : 'text-blue-500'}`}>{testResult.msg}</span>}
              </div>
            </Row>

            <Row label={t('settings.ai.model')} badge={getStatusBadge(false)} noBorder={!advancedAiOpen}>
              <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center relative">
                  <select
                    value={settings.ai.model || ''}
                    onChange={(e) => updateSetting('ai', 'model', e.target.value)}
                    className="h-9 block w-48 rounded-md border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-gray-100 px-3 py-1"
                  >
                    <option value="" disabled>Select model</option>
                    {modelsList.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {settings.ai.model && !modelsList.includes(settings.ai.model) && (
                      <option value={settings.ai.model}>{settings.ai.model}</option>
                    )}
                  </select>
                  <Button variant="secondary" onClick={handleTestModel}>Test</Button>
                </div>
                {modelsResult && <span className={`text-sm ${modelsResult.type === 'error' ? 'text-red-500' : modelsResult.type === 'success' ? 'text-green-500' : 'text-yellow-600 dark:text-yellow-500'}`}>{modelsResult.msg}</span>}
              </div>
            </Row>
            
            <div className="mt-4 border-t border-gray-100 dark:border-zinc-800 pt-4">
              <button 
                className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center focus:outline-none mb-4"
                onClick={() => setAdvancedAiOpen(!advancedAiOpen)}
              >
                {t('settings.ai.advancedOptions')}
                <svg className={`w-4 h-4 ml-1 transform transition-transform ${advancedAiOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {advancedAiOpen && (
                <div className="space-y-4">
                  {isCliMode && (
                    <>
                      <Row label="Override CLI Binary Path" badge={getStatusBadge(false)}>
                        <Input value={settings.ai.overrideCliPath || ''} onChange={(v) => updateSetting('ai', 'overrideCliPath', v)} className="w-64" />
                      </Row>
                      <Row label="CLI Arguments" badge={getStatusBadge(false)}>
                        <Input value={settings.ai.cliArguments || ''} onChange={(v) => updateSetting('ai', 'cliArguments', v)} className="w-64" />
                      </Row>
                    </>
                  )}
                  <Row label={t('settings.ai.temperature')} badge={getStatusBadge(false)}>
                    <Input type="number" step="0.1" min="0" max="1" value={settings.ai.temperature} onChange={(v) => updateSetting('ai', 'temperature', Number(v))} className="w-24" />
                  </Row>
                  <Row label={t('settings.ai.systemPrompt')} badge={getStatusBadge(false)} noBorder>
                    <div className="w-full mt-2">
                      <Textarea value={settings.ai.systemPrompt} onChange={(v) => updateSetting('ai', 'systemPrompt', v)} rows={5} />
                    </div>
                  </Row>
                </div>
              )}
            </div>
            
            
          </div>
        );
      case 'mcp':
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <SectionTitle>{t('settings.mcp.title')}</SectionTitle>
                  {getStatusBadge(false)}
                </div>
                <Description>{t('settings.mcp.description')}</Description>
              </div>
              <Button onClick={() => setShowAddMcpModal(true)}><Plus size={16} className="mr-2" /> {t('settings.mcp.addServer')}</Button>
            </div>
            
            {mcpServers.length > 0 ? (
              <div className="space-y-4">
                {mcpServers.map(server => (
                  <div key={server.name} className="flex items-center justify-between p-4 border border-gray-100 dark:border-zinc-800 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {server.name}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${server.status === 'connected' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : server.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>{server.status}</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1 font-mono text-xs">{server.command} {server.args && server.args.join(' ')}</div>
                      <div className="text-sm text-gray-500 mt-1">{server.toolsCount} tools exposed</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="danger" onClick={() => handleRemoveMcpServer(server.name)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-24 h-24 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-zinc-700">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
                <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">{t('settings.mcp.emptyTitle')}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{t('settings.mcp.emptyDesc')}</p>
              </div>
            )}

            {showAddMcpModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Add MCP Server</h3>
                    <button onClick={() => setShowAddMcpModal(false)} className="text-gray-400 hover:text-gray-500"><X size={20} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                      <Input value={mcpForm.name} onChange={(v) => setMcpForm(f => ({ ...f, name: v }))} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Command</label>
                      <Input value={mcpForm.command} onChange={(v) => setMcpForm(f => ({ ...f, command: v }))} className="w-full" placeholder="e.g. npx, python, etc." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Arguments (space separated)</label>
                      <Input value={mcpForm.args} onChange={(v) => setMcpForm(f => ({ ...f, args: v }))} className="w-full" placeholder="-y @modelcontextprotocol/server-sqlite" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment Variables (KEY=VALUE per line)</label>
                      <Textarea value={mcpForm.env} onChange={(v) => setMcpForm(f => ({ ...f, env: v }))} className="w-full font-mono text-xs" rows={3} placeholder="GITHUB_TOKEN=abc123&#10;API_KEY=xyz" />
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-900/50 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setShowAddMcpModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleAddMcpServer}>Add Server</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'skills':
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <SectionTitle>{t('settings.skills.title')}</SectionTitle>
                  {getStatusBadge(false)}
                </div>
                <Description>{t('settings.skills.description')}</Description>
              </div>
              <Button onClick={() => setShowCreateSkillModal(true)}><Plus size={16} className="mr-2" /> {t('settings.skills.addSkill')}</Button>
            </div>
            {skills && skills.length > 0 ? (
              <div className="space-y-4">
                {skills.map(skill => (
                  <div key={skill.id} className="flex items-center justify-between p-4 border border-gray-100 dark:border-zinc-800 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{skill.name}</div>
                      <div className="text-sm text-gray-500">{skill.description || 'No description'}</div>
                    </div>
                    <Toggle checked={skill.enabled} onChange={(v) => toggleSkill(skill.id, v)} />
                  </div>
                ))}
              </div>
            ) : !workspaceConnected ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-24 h-24 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4 border border-orange-100 dark:border-orange-800/30">
                  <svg className="w-10 h-10 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">No Workspace Connected</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">Please mount or connect a workspace to discover and manage local skills.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-24 h-24 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-zinc-700">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">{t('settings.skills.emptyTitle')}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{t('settings.skills.emptyDesc')}</p>
              </div>
            )}
          </div>
        );
      case 'integrations':
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div>
                <SectionTitle>{t('settings.integrations.title')}</SectionTitle>
                <Description>{t('settings.integrations.description')}</Description>
              </div>
              {getStatusBadge(false)}
            </div>
            <Row label={t('settings.integrations.engine')} description={<span className="text-xs text-gray-500">DeepSeek V3 · 8 tools enabled</span>} badge={getStatusBadge(false)}>
              <div className="flex gap-2">
                {['shell', 'filesystem', 'browser', 'docs'].map(badge => (
                  <span key={badge} className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs">{badge}</span>
                ))}
              </div>
            </Row>
            <Row label={t('settings.integrations.proxy')} description={t('settings.integrations.proxyReload')} badge={getStatusBadge(false)} noBorder>
              <div className="flex gap-4 items-center">
                <Toggle checked={false} onChange={() => {}} />
                <Button variant="secondary">{t('settings.integrations.proxyReload')}</Button>
              </div>
            </Row>
          </div>
        );
      case 'advanced':
        return (
          <div className="bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
              <div>
                <SectionTitle>{t('settings.advanced.title')}</SectionTitle>
                <Description>{t('settings.advanced.description')}</Description>
              </div>
              {getStatusBadge(false)}
            </div>
            <Row label={t('settings.advanced.logLevel')} badge={getStatusBadge(false)}>
              <Select value={settings.advanced.logLevel} onChange={(v) => updateSetting('advanced', 'logLevel', v)} options={['Debug', 'Info', 'Warn', 'Error']} />
            </Row>
            <Row label={t('settings.advanced.telemetry')} badge={getStatusBadge(false)}>
              <Toggle checked={settings.advanced.telemetry} onChange={(v) => updateSetting('advanced', 'telemetry', v)} />
            </Row>
            <Row label={t('settings.advanced.exportImport')} badge={getStatusBadge(false)}>
              <div className="flex gap-2">
                <Button variant="secondary">{t('settings.advanced.exportBtn')}</Button>
                <Button variant="secondary">{t('settings.advanced.importBtn')}</Button>
              </div>
            </Row>
            <Row label="" badge={getStatusBadge(false)} noBorder>
              <Button variant="danger">{t('settings.advanced.clearCache')}</Button>
            </Row>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full w-full bg-gray-50 dark:bg-zinc-950 relative">
      {/* Mobile Menu Toggle */}
      <div className="md:hidden absolute top-4 left-4 z-20">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white dark:bg-zinc-800 rounded-md shadow-sm border border-gray-200 dark:border-zinc-700">
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Left Sidebar */}
      <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-200 ease-in-out absolute md:relative z-10 w-64 h-full flex-shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col`}>
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800 md:pt-4 pt-16">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={t('settings.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 block w-full pl-10 pr-3 rounded-md bg-gray-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-gray-100 transition-colors"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-1">
            {filteredGroups.map(group => (
              <div key={group.title} className="mb-4 last:mb-0">
                <div className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-4">
                  {group.title}
                </div>
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigate(`/settings/${item.id}`, { replace: true });
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-md transition-colors text-sm ${
                      activeTab === item.id 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8 pt-16 md:pt-8 bg-gray-50 dark:bg-zinc-950">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            {menuGroups.flatMap(g => g.items).find(i => i.id === activeTab)?.label}
          </h2>
          {renderContent()}
        </div>
      </div>
      
      {/* Overlay for mobile drawer */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-0 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Create Skill Modal */}
      {showCreateSkillModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-zinc-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create New Skill</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skill Name</label>
                <Input 
                  value={newSkillName} 
                  onChange={setNewSkillName} 
                  className="w-full" 
                  placeholder="e.g. Git Commit Assistant" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <Textarea 
                  value={newSkillDesc} 
                  onChange={setNewSkillDesc} 
                  className="w-full" 
                  rows={3} 
                  placeholder="A short description of what this skill does..." 
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowCreateSkillModal(false)}>Cancel</Button>
              <Button onClick={handleCreateSkill} disabled={!newSkillName || !newSkillDesc}>Create Skill</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
