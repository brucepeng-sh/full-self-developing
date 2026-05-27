import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n from '../i18n';
import { apiFetch } from '../api';
import { toast } from 'react-toastify';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettingsState] = useState(() => {
    // Initial load of ALL settings from localStorage to prevent flickering
    try {
      const stored = localStorage.getItem('fsd_all_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Ensure cookie matches the localStorage theme
        if (parsed.ui?.theme) {
          const isDark = parsed.ui.theme === 'Dark' || (parsed.ui.theme === 'System' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          document.cookie = `theme=${isDark ? 'dark' : 'light'}; path=/; max-age=31536000`;
        }
        
        if (parsed.ai && (!parsed.aiTools || parsed.aiTools.length === 0)) {
            parsed.aiTools = [{
                ...parsed.ai,
                id: 'default-legacy',
                name: 'Default AI',
                isDefault: true
            }];
        }
        if (!parsed.aiTools) parsed.aiTools = [];
        
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse local settings', e);
    }
    
    const themeMatch = document.cookie.match(/(?:^|; )theme=([^;]*)/);
    const initialUi = { theme: 'Light', language: 'English' };
    if (themeMatch) {
      initialUi.theme = themeMatch[1] === 'dark' ? 'Dark' : 'Light';
    }
    
    return {
      aiTools: [],
      ai: { model: 'Loading...' },
      ui: initialUi,
      fsd: {},
      memory: {},
      safety: {},
      advanced: {}
    };
  });

  const [engine, setEngineState] = useState(() => {
    try {
      const stored = localStorage.getItem('fsd_all_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.ai?.executionMode === 'Local CLI Driver' || parsed.ai?.provider === 'gemini-cli') {
          return 'gemini-cli';
        }
      }
    } catch (e) {}
    return 'openrouter';
  });
  const [models, setModels] = useState([]);
  const [skills, setSkills] = useState([]);
  const [serverConnected, setServerConnected] = useState(false);
  const [workspaceConnected, setWorkspaceConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyUiSettings = useCallback((uiSettings) => {
    const theme = uiSettings.theme || 'Light';
    
    const applyTheme = (isDark) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.cookie = "theme=dark; path=/; max-age=31536000";
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.cookie = "theme=light; path=/; max-age=31536000";
      }
    };

    if (theme === 'Dark') {
      applyTheme(true);
    } else if (theme === 'Light') {
      applyTheme(false);
    } else {
      // System
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark);
    }

    // Apply language
    const langMap = {
      'English': 'en',
      '中文 (简体)': 'zh',
      '日本語': 'ja',
      '한국어': 'ko',
      'Español': 'es'
    };
    if (i18n && uiSettings.language) {
      i18n.changeLanguage(langMap[uiSettings.language] || 'en');
    }
  }, []);

  // Sync theme/language from state to DOM
  useEffect(() => {
    applyUiSettings(settings.ui);
  }, [settings.ui, applyUiSettings]);

  // Load configuration from backend
  const fetchSettingsAndEngine = useCallback(async () => {
    try {
      const data = await apiFetch('/api/settings');
      const statusData = await apiFetch('/api/engine/status');
      
      const backendSettings = data.settings || {};
      const currentEngine = statusData.currentEngine || 'openrouter';
      
      setEngineState(currentEngine);
      setServerConnected(true);
      
      // Load models list
      const modelsData = await apiFetch('/api/engine/models');
      setModels(modelsData.models || []);

      // Load skills
      try {
        const toolsData = await apiFetch('/api/engine/tools');
        setSkills(toolsData.skills || []);
        setWorkspaceConnected(!!toolsData.workspacePath);
      } catch (e) {
        console.error('Failed to load skills', e);
      }

      // Get latest local settings as fallback
      let localSettings = {};
      try {
        const stored = localStorage.getItem('fsd_all_settings');
        if (stored) {
          localSettings = JSON.parse(stored);
        }
      } catch (e) {}

      const mergedSettings = {
        ...localSettings,
        ...backendSettings
      };
      
      if (mergedSettings.ai && (!mergedSettings.aiTools || mergedSettings.aiTools.length === 0)) {
          mergedSettings.aiTools = [{
              ...mergedSettings.ai,
              id: 'default-legacy',
              name: 'Default AI',
              isDefault: true
          }];
      }
      if (!mergedSettings.aiTools) mergedSettings.aiTools = [];
      
      // Update localStorage with merged settings
      localStorage.setItem('fsd_all_settings', JSON.stringify(mergedSettings));

      setSettingsState(mergedSettings);
      setLoading(false);
    } catch (e) {
      console.error('Failed to load settings from backend', e);
      setServerConnected(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettingsAndEngine();
  }, [fetchSettingsAndEngine]);

  // Heartbeat to monitor server status
  useEffect(() => {
    const checkServer = async () => {
      try {
        await apiFetch('/api/heartbeat', { method: 'POST' });
        setServerConnected(true);
      } catch (e) {
        setServerConnected(false);
      }
    };
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  const getEngineForSettings = (newSettings) => {
    const ai = newSettings.ai || {};
    return ai.executionMode === 'Local CLI Driver' || ai.provider === 'gemini-cli'
      ? 'gemini-cli'
      : 'openrouter';
  };

  const notifySettingsSaved = () => {
    toast.success('Settings saved', {
      toastId: 'settings-saved',
      position: 'bottom-right',
      autoClose: 1600
    });
  };

  const saveSettingsToBackend = async (newSettings) => {
    try {
      await apiFetch('/api/engine/config', {
        method: 'PUT',
        body: JSON.stringify({
          engine: getEngineForSettings(newSettings),
          model: newSettings.ai?.model,
          settings: newSettings
        })
      });
      
      // Sync engine state and model list
      const statusData = await apiFetch('/api/engine/status');
      setEngineState(statusData.currentEngine || 'openrouter');
      
      const modelsData = await apiFetch('/api/engine/models');
      setModels(modelsData.models || []);
      setServerConnected(true);
      notifySettingsSaved();
    } catch (e) {
      console.error('Failed to save settings to backend', e);
      setServerConnected(false);
      toast.error('Failed to save settings', {
        toastId: 'settings-save-failed',
        position: 'bottom-right',
        autoClose: 2200
      });
    }
  };

  const updateSetting = useCallback((category, key, value) => {
    setSettingsState(prev => {
      const updated = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      };

      if (category === 'ui') {
        localStorage.setItem('fsd_all_settings', JSON.stringify(updated));
        applyUiSettings(updated.ui);
      }
      
      saveSettingsToBackend(updated);
      return updated;
    });
  }, [applyUiSettings]);

  const updateSettingsBatch = useCallback((newSettings) => {
    setSettingsState(newSettings);
    localStorage.setItem('fsd_all_settings', JSON.stringify(newSettings));
    applyUiSettings(newSettings.ui);
    saveSettingsToBackend(newSettings);
  }, [applyUiSettings]);

  const setEngine = useCallback(async (newEngine) => {
    try {
      setEngineState(newEngine);
      await apiFetch('/api/engine/switch', {
        method: 'POST',
        body: JSON.stringify({ engine: newEngine })
      });
      
      // Update executionMode / provider settings to match new engine
      setSettingsState(prev => {
        const updated = {
          ...prev,
          ai: {
            ...prev.ai,
            executionMode: newEngine === 'gemini-cli' ? 'Local CLI Driver' : 'HTTP API',
            provider: newEngine === 'gemini-cli' ? 'gemini-cli' : 'OpenRouter'
          }
        };
        saveSettingsToBackend(updated);
        return updated;
      });

      // Reload models
      const modelsData = await apiFetch('/api/engine/models');
      setModels(modelsData.models || []);
      setServerConnected(true);
    } catch (e) {
      console.error('Failed to switch engine on backend', e);
      setServerConnected(false);
    }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const modelsData = await apiFetch('/api/engine/models');
      setModels(modelsData.models || []);
      setServerConnected(true);
    } catch (e) {
      console.error('Failed to refresh models from backend', e);
      setServerConnected(false);
    }
  }, []);

  const toggleSkill = useCallback(async (skillId, enabled) => {
    try {
      await apiFetch('/api/engine/skills/toggle', {
        method: 'POST',
        body: JSON.stringify({ skillId, enabled })
      });
      // Refresh skills
      const toolsData = await apiFetch('/api/engine/tools');
      setSkills(toolsData.skills || []);
    } catch (e) {
      console.error('Failed to toggle skill', e);
      toast.error('Failed to toggle skill');
    }
  }, []);

  const createSkill = useCallback(async (name, description) => {
    try {
      const result = await apiFetch('/api/engine/skills/create', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
      
      if (result.success) {
        toast.success('Skill created successfully');
        // Refresh skills
        const toolsData = await apiFetch('/api/engine/tools');
        setSkills(toolsData.skills || []);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to create skill', e);
      toast.error(`Failed to create skill: ${e.message}`);
      return false;
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      engine, 
      models, 
      skills,
      serverConnected, 
      workspaceConnected,
      loading,
      updateSetting, 
      updateSettingsBatch, 
      setEngine, 
      refreshModels,
      toggleSkill,
      createSkill
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
