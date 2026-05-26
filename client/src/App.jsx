import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ChatPanel from './components/ChatPanel'
import LoopPanel from './components/LoopPanel'
import FolderPicker from './components/FolderPicker'
import SettingsPanel from './components/SettingsPanel'
import NotFound from './components/NotFound'
import ErrorBoundary from './components/ErrorBoundary'
import { apiFetch, getToken } from './api'
import { useSettings } from './context/SettingsContext'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

function SettingsPanelWrapper() {
  const { tab } = useParams()
  return (
    <ErrorBoundary name="Settings Panel">
      <SettingsPanel defaultTab={tab || 'ui'} />
    </ErrorBoundary>
  )
}

function App() {
  const [lang, setLang] = useState('en')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  
  const { settings, engine, setEngine, models, serverConnected } = useSettings()
  
  const [projectPath, setProjectPath] = useState('')
  const [isFolderPickerOpen, setFolderPickerOpen] = useState(false)
  
  const [sessions, setSessions] = useState([])
  const [trashSessions, setTrashSessions] = useState([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [messages, setMessages] = useState([])
  const [prompt, setPrompt] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  
  const [loopState, setLoopState] = useState('idle')
  const [tasks, setTasks] = useState([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  
  const [rpmActive, setRpmActive] = useState(0)
  const [rpdActive, setRpdActive] = useState(0)
  const [tokenConsumed, setTokenConsumed] = useState(0)
  const [tokenTotal, setTokenTotal] = useState(1000000)
  const [tokenPercent, setTokenPercent] = useState(100)

  // React Router hooks
  const location = useLocation()
  const navigate = useNavigate()

  // Derive routing parameters from URL pathname
  let activeTab = 'chat'
  if (location.pathname.startsWith('/fsd')) {
    activeTab = 'loop'
  } else if (location.pathname.startsWith('/settings')) {
    activeTab = 'settings'
  }

  const chatMatch = location.pathname.match(/^\/c\/([^/]+)$/)
  const activeSessionId = chatMatch ? chatMatch[1] : null

  const fsdMatch = location.pathname.match(/^\/fsd\/([^/]+)$/)
  const activeTaskId = fsdMatch ? fsdMatch[1] : null

  const settingsMatch = location.pathname.match(/^\/settings\/([^/]+)$/)
  const settingsTab = settingsMatch ? settingsMatch[1] : 'ui'

  // Load session history when activeSessionId changes (via URL routing)
  useEffect(() => {
    if (activeSessionId) {
      loadSessionHistory(activeSessionId)
    } else {
      setMessages([])
      setTokenConsumed(0)
    }
  }, [activeSessionId])

  // Dynamic browser tab document title
  useEffect(() => {
    if (activeTab === 'chat') {
      if (activeSessionId) {
        const session = sessions.find(s => s.id === activeSessionId)
        document.title = session ? `${session.title} - FSD` : 'Chat - FSD'
      } else {
        document.title = 'New Chat - FSD'
      }
    } else if (activeTab === 'loop') {
      if (activeTaskId) {
        const task = tasks.find(t => t.id === activeTaskId)
        const taskTitle = task?.plan?.title || task?.suggestion?.title || `Task #${activeTaskId.slice(0, 4)}`
        document.title = `${taskTitle} - FSD`
      } else {
        document.title = 'Task Panel - FSD'
      }
    } else if (activeTab === 'settings') {
      document.title = `Settings (${settingsTab.toUpperCase()}) - FSD`
    } else {
      document.title = 'FSD'
    }
  }, [activeTab, activeSessionId, activeTaskId, sessions, tasks, settingsTab])

  const getModelContextLimit = (modelName) => {
    if (!modelName) return 1000000;
    const name = modelName.toLowerCase();
    if (name.includes('gemini-2.5-pro') || name.includes('gemini-1.5-pro') || name.includes('gemini-2-pro')) return 2000000;
    if (name.includes('gemini-2.5-flash') || name.includes('gemini-1.5-flash') || name.includes('gemini-2-flash')) return 1000000;
    if (name.includes('claude-3-5') || name.includes('claude-3.5')) return 200000;
    if (name.includes('claude')) return 200000;
    if (name.includes('gpt-4') || name.includes('gpt-3.5') || name.includes('deepseek')) return 128000;
    return 1000000;
  }

  useEffect(() => {
    const activeModel = settings?.ai?.model || ''
    const limit = getModelContextLimit(activeModel)
    setTokenTotal(limit)
    if (limit > 0) {
      setTokenPercent(Math.max(0, Math.round(((limit - tokenConsumed) / limit) * 100)))
    }
  }, [settings?.ai?.model])

  useEffect(() => {
    if (tokenTotal > 0) {
      setTokenPercent(Math.max(0, Math.round(((tokenTotal - tokenConsumed) / tokenTotal) * 100)))
    }
  }, [tokenConsumed, tokenTotal])

  const loopSSERef = useRef(null)

  // Initialization
  useEffect(() => {
    // Load initial data
    loadSessions()
    loadLoopData()
    connectLoopSSE()
    loadWorkspace()

    return () => {
      if (loopSSERef.current) loopSSERef.current.close()
    }
  }, [])

  const loadWorkspace = async () => {
    try {
      const data = await apiFetch('/api/workspace')
      if (data.workspace) {
        setProjectPath(data.workspace)
      }
    } catch (e) {
      console.error(e)
      toast.error(`Failed to load active workspace: ${e.message}`)
    }
  }

  const loadSessions = async () => {
    try {
      const data = await apiFetch('/api/sessions')
      setSessions(data.sessions || [])
      
      const trashData = await apiFetch('/api/sessions/trash')
      setTrashSessions(trashData.sessions || [])
    } catch (e) {
      console.error(e)
      toast.error(`Failed to load sessions: ${e.message}`)
    } finally {
      setIsLoadingSessions(false)
    }
  }

  const handleRestoreSession = async (id) => {
    try {
      await apiFetch('/api/sessions/restore', {
        method: 'POST',
        body: JSON.stringify({ id })
      })
      loadSessions()
      toast.success('Session restored successfully')
    } catch (e) {
      console.error(e)
      toast.error(`Failed to restore session: ${e.message}`)
    }
  }

  const loadSessionHistory = async (id) => {
    try {
      const data = await apiFetch(`/api/sessions/${id}/history`)
      setMessages(data.history.map(m => ({
        role: m.role,
        content: m.text
      })))
      if (data.usage) {
        setTokenConsumed(data.usage.total_tokens || data.usage.prompt_tokens + data.usage.completion_tokens || 0)
      } else {
        setTokenConsumed(0)
      }
    } catch (e) {
      console.error(e)
      toast.error(`Failed to load session history: ${e.message}`)
    }
  }

  const handleSelectSession = (id) => {
    navigate(`/c/${id}`)
  }

  const handleDeleteSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    try {
      const res = await apiFetch('/api/sessions/delete', {
        method: 'POST',
        body: JSON.stringify({ index: session.index })
      })
      const sessionId = res.sessionId
      if (activeSessionId === id) {
        navigate('/c')
      }
      loadSessions()
      toast.success(
        <div className="flex items-center justify-between gap-2">
          <span>Session deleted</span>
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await apiFetch('/api/sessions/restore', {
                  method: 'POST',
                  body: JSON.stringify({ id: sessionId })
                });
                loadSessions();
                toast.dismiss();
                toast.success('Session restored');
              } catch (err) {
                toast.error(`Failed to restore: ${err.message}`);
              }
            }}
            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-bold uppercase transition"
          >
            Undo
          </button>
        </div>,
        { autoClose: 5000 }
      )
    } catch (e) {
      console.error(e)
      toast.error(`Failed to delete session: ${e.message}`)
    }
  }

  const handleNewSession = () => {
    navigate('/c')
  }

  const handleOpenProject = async (path) => {
    setFolderPickerOpen(false)
    if (!path) return
    try {
      await apiFetch('/api/workspace', {
        method: 'POST',
        body: JSON.stringify({ path })
      })
      setProjectPath(path)
      toast.success(`Opened workspace: ${path}`)
    } catch (e) {
      console.error(e)
      toast.error(`Failed to open workspace: ${e.message}`)
    }
  }

  const handleCloseProject = async () => {
    try {
      await apiFetch('/api/workspace', {
        method: 'DELETE'
      })
      setProjectPath('')
      toast.success('Workspace closed')
    } catch (e) {
      console.error(e)
      toast.error(`Failed to close workspace: ${e.message}`)
    }
  }

  const handleSend = async (customPrompt) => {
    const promptToSend = typeof customPrompt === 'string' ? customPrompt : prompt
    if (!promptToSend.trim() || isStreaming) return
    
    if (customPrompt === undefined) {
      setPrompt('')
    }
    
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].role === 'user' && prev[prev.length - 1].content === promptToSend) {
        return [...prev, { role: 'model', content: '' }]
      }
      return [...prev, { role: 'user', content: promptToSend }, { role: 'model', content: '' }]
    })
    setIsStreaming(true)
    
    let sse;
    try {
      const token = await getToken()
      const activeModel = settings?.ai?.model || ''
      const activeEngine = engine || 'gemini-cli'
      sse = new EventSource(`/api/chat/stream?prompt=${encodeURIComponent(promptToSend)}&resumeId=${activeSessionId || ''}&model=${activeModel}&engine=${activeEngine}&token=${token}`)
      
      sse.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.text) {
            setMessages(prev => {
              const newMsgs = [...prev]
              const lastMsg = newMsgs[newMsgs.length - 1]
              if (lastMsg && lastMsg.role === 'model') {
                newMsgs[newMsgs.length - 1] = {
                  ...lastMsg,
                  content: lastMsg.content + data.text
                }
              }
              return newMsgs
            })
          }
        } catch (err) {}
      })
      
      sse.addEventListener('done', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.usage) {
            setTokenConsumed(data.usage.total_tokens || data.usage.prompt_tokens + data.usage.completion_tokens || 0)
          }
        } catch (err) {}
        sse.close()
        setIsStreaming(false)
        loadSessions() 
        setTimeout(() => {
          apiFetch('/api/sessions').then(data => {
            setSessions(data.sessions || [])
            if (!activeSessionId && data.sessions.length > 0) {
              // Navigate to the newly created session
              navigate(`/c/${data.sessions[0].id}`, { replace: true })
            } else if (activeSessionId) {
              loadSessionHistory(activeSessionId)
            }
          }).catch(() => {})
        }, 500)
      })
      
      sse.addEventListener('error', (e) => {
        let errorMsg = 'Stream connection failed';
        if (e.data) {
          try {
            const parsed = JSON.parse(e.data);
            errorMsg = parsed.message || (typeof parsed.error === 'string' ? parsed.error : null) || parsed.details || errorMsg;
          } catch (err) {}
        }
        
        setMessages(prev => {
          const newMsgs = [...prev]
          const lastMsg = newMsgs[newMsgs.length - 1]
          if (lastMsg && lastMsg.role === 'model') {
            newMsgs[newMsgs.length - 1] = {
              ...lastMsg,
              isError: true,
              error: errorMsg
            }
          }
          return newMsgs
        })
        
        sse.close()
        setIsStreaming(false)
      })
    } catch (err) {
      setMessages(prev => {
        const newMsgs = [...prev]
        const lastMsg = newMsgs[newMsgs.length - 1]
        if (lastMsg && lastMsg.role === 'model') {
          newMsgs[newMsgs.length - 1] = {
            ...lastMsg,
            isError: true,
            error: err.message || 'Failed to initialize event stream'
          }
        }
        return newMsgs
      })
      setIsStreaming(false)
    }
  }

  const handleRetry = (promptText) => {
    setMessages(prev => {
      if (prev.length > 0 && prev[prev.length - 1].role === 'model' && prev[prev.length - 1].isError) {
        return prev.slice(0, -1)
      }
      return prev
    })
    handleSend(promptText)
  }

  const handleStopChat = async () => {
    try {
      await apiFetch('/api/chat/stop', { method: 'POST' })
      setIsStreaming(false)
    } catch (e) {
      console.error(e)
      toast.error(`Failed to stop generation: ${e.message}`)
    }
  }

  // Loop specific
  const loadLoopData = async () => {
    try {
      const sData = await apiFetch('/api/loop/status')
      setLoopState(sData.running ? 'running' : 'idle')
      const tData = await apiFetch('/api/loop/tasks')
      setTasks(tData.tasks || [])
    } catch (e) {
      console.error(e)
      toast.error(`Failed to load loop data: ${e.message}`)
    } finally {
      setIsLoadingTasks(false)
    }
  }

  const connectLoopSSE = async () => {
    const token = await getToken()
    const sse = new EventSource(`/api/loop/stream?token=${token}`)
    loopSSERef.current = sse
    
    sse.addEventListener('loop_status', (e) => {
      const { running } = JSON.parse(e.data)
      setLoopState(running ? 'running' : 'idle')
    })
    sse.addEventListener('task_updated', (e) => {
      const updated = JSON.parse(e.data)
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === updated.id)
        if (idx >= 0) {
          const newT = [...prev]
          newT[idx] = updated
          return newT
        }
        return [updated, ...prev]
      })
    })
    sse.addEventListener('task_created', (e) => {
      const created = JSON.parse(e.data)
      setTasks(prev => [created, ...prev])
    })
  }

  const handleStartLoop = async () => {
    await apiFetch('/api/loop/start', { method: 'POST' })
    setLoopState('running')
  }

  const handleStopLoop = async () => {
    await apiFetch('/api/loop/stop', { method: 'POST' })
    setLoopState('idle')
  }

  const handleStartAll = async () => {
    try {
      await apiFetch('/api/loop/start-all', { method: 'POST' })
      setLoopState('running')
      loadLoopData()
      toast.success('Started all pending loop tasks')
    } catch (e) {
      console.error('Failed to start all tasks:', e)
      toast.error(`Failed to start all tasks: ${e.message}`)
    }
  }

  const handleStopAll = async () => {
    try {
      await apiFetch('/api/loop/stop-all', { method: 'POST' })
      setLoopState('idle')
      loadLoopData()
      toast.success('Stopped all loop tasks')
    } catch (e) {
      console.error('Failed to stop all tasks:', e)
      toast.error(`Failed to stop all tasks: ${e.message}`)
    }
  }

  const handleStopTask = async (id) => {
    try {
      await apiFetch(`/api/loop/tasks/${id}/stop`, { method: 'POST' })
      loadLoopData()
      toast.success('Task stopped successfully')
    } catch (e) {
      console.error('Failed to stop task:', e)
      toast.error(`Failed to stop task: ${e.message}`)
    }
  }

  const handleRetryTask = async (id, options = {}) => {
    try {
      await apiFetch(`/api/loop/tasks/${id}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      })
      loadLoopData()
      toast.success(options.resetCoding ? 'Resetting coding and retrying' : 'Retrying task execution')
    } catch (e) {
      console.error('Failed to retry task:', e)
      toast.error(`Failed to retry task: ${e.message}`)
    }
  }

  const handleTriggerLoop = async () => {
    try {
      await apiFetch('/api/loop/trigger', { method: 'POST' })
      toast.success('Loop agent cycle triggered manually')
    } catch (e) {
      toast.error(`Failed to trigger loop cycle: ${e.message}`)
    }
  }

  const handleApproveTask = async (id) => {
    try {
      await apiFetch(`/api/loop/tasks/${id}/approve`, { method: 'POST' })
      toast.success('Task execution approved')
    } catch (e) {
      console.error('Failed to approve task:', e)
      toast.error(`Failed to approve task: ${e.message}`)
    }
  }

  const handleApprovePatch = async (id) => {
    try {
      await apiFetch(`/api/loop/tasks/${id}/approve_patch`, { method: 'POST' })
      toast.success('Patch approved and writing to disk')
      loadLoopData()
    } catch (e) {
      console.error('Failed to approve patch:', e)
      toast.error(`Failed to approve patch: ${e.message}`)
    }
  }

  const handleRejectTask = async (id) => {
    try {
      await apiFetch(`/api/loop/tasks/${id}/reject`, { method: 'POST' })
      toast.success('Task execution rejected')
    } catch (e) {
      console.error('Failed to reject task:', e)
      toast.error(`Failed to reject task: ${e.message}`)
    }
  }

  const handleDeleteTask = async (id) => {
    try {
      await apiFetch(`/api/loop/tasks/${id}`, {
        method: 'DELETE'
      })
      if (activeTaskId === id) {
        navigate('/fsd')
      }
      loadLoopData()
      toast.success(
        <div className="flex items-center justify-between gap-2">
          <span>Task deleted</span>
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await apiFetch(`/api/loop/tasks/${id}/restore`, {
                  method: 'POST'
                });
                loadLoopData();
                toast.dismiss();
                toast.success('Task restored');
              } catch (err) {
                toast.error(`Failed to restore: ${err.message}`);
              }
            }}
            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-bold uppercase transition"
          >
            Undo
          </button>
        </div>,
        { autoClose: 5000 }
      )
    } catch (e) {
      console.error('Failed to delete task:', e)
      toast.error(`Failed to delete task: ${e.message}`)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-zinc-950">
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        activeTab={activeTab}
        onSwitchTab={(tab, subTab) => {
          if (tab === 'chat') {
            navigate(activeSessionId ? `/c/${activeSessionId}` : '/c')
          } else if (tab === 'loop') {
            navigate(activeTaskId ? `/fsd/${activeTaskId}` : '/fsd')
          } else if (tab === 'settings') {
            navigate(subTab ? `/settings/${subTab}` : '/settings/ui')
          }
        }}
        onNewSession={handleNewSession}
        onOpenProject={() => setFolderPickerOpen(true)}
        projectPath={projectPath}
        onCloseProject={handleCloseProject}
        engine={engine}
        setEngine={setEngine}
        models={models}
        sessions={sessions}
        trashSessions={trashSessions}
        isLoadingSessions={isLoadingSessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRestoreSession={handleRestoreSession}
        rpmActive={rpmActive}
        rpdActive={rpdActive}
        serverConnected={serverConnected}
      />
      
      <main className="flex-1 flex flex-col min-w-0 h-full bg-white dark:bg-zinc-950 relative">
        <div className="flex-1 min-h-0 animate-fade-in" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Navigate to="/c" replace />} />
            
            <Route path="/c" element={
              <ErrorBoundary name="Chat Panel">
                <ChatPanel 
                  messages={messages}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  onSend={handleSend}
                  onStop={handleStopChat}
                  isStreaming={isStreaming}
                  tokenConsumed={tokenConsumed}
                  tokenTotal={tokenTotal}
                  tokenPercent={tokenPercent}
                  projectPath={projectPath}
                  onOpenProject={() => setFolderPickerOpen(true)}
                  engine={engine}
                  activeModel={settings?.ai?.model}
                  requireApproval={settings?.fsd?.requireApproval !== false}
                  loopState={loopState}
                  onRetry={handleRetry}
                />
              </ErrorBoundary>
            } />
            
            <Route path="/c/:id" element={
              <ErrorBoundary name="Chat Panel">
                <ChatPanel 
                  messages={messages}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  onSend={handleSend}
                  onStop={handleStopChat}
                  isStreaming={isStreaming}
                  tokenConsumed={tokenConsumed}
                  tokenTotal={tokenTotal}
                  tokenPercent={tokenPercent}
                  projectPath={projectPath}
                  onOpenProject={() => setFolderPickerOpen(true)}
                  engine={engine}
                  activeModel={settings?.ai?.model}
                  requireApproval={settings?.fsd?.requireApproval !== false}
                  loopState={loopState}
                  onRetry={handleRetry}
                />
              </ErrorBoundary>
            } />
            
            <Route path="/fsd" element={
              <ErrorBoundary name="Loop Task Panel">
                <LoopPanel 
                  loopState={loopState}
                  tasks={tasks}
                  isLoadingTasks={isLoadingTasks}
                  onStartLoop={handleStartLoop}
                  onStopLoop={handleStopLoop}
                  onStartAll={handleStartAll}
                  onStopAll={handleStopAll}
                  onTriggerLoop={handleTriggerLoop}
                  activeTaskId={activeTaskId}
                  onSelectTask={(id) => navigate(`/fsd/${id}`)}
                  onApproveTask={handleApproveTask}
                  onApprovePatch={handleApprovePatch}
                  onRejectTask={handleRejectTask}
                  onStopTask={handleStopTask}
                  onRetryTask={handleRetryTask}
                  onDeleteTask={handleDeleteTask}
                />
              </ErrorBoundary>
            } />
            
            <Route path="/fsd/:id" element={
              <ErrorBoundary name="Loop Task Panel">
                <LoopPanel 
                  loopState={loopState}
                  tasks={tasks}
                  isLoadingTasks={isLoadingTasks}
                  onStartLoop={handleStartLoop}
                  onStopLoop={handleStopLoop}
                  onStartAll={handleStartAll}
                  onStopAll={handleStopAll}
                  onTriggerLoop={handleTriggerLoop}
                  activeTaskId={activeTaskId}
                  onSelectTask={(id) => navigate(`/fsd/${id}`)}
                  onApproveTask={handleApproveTask}
                  onApprovePatch={handleApprovePatch}
                  onRejectTask={handleRejectTask}
                  onStopTask={handleStopTask}
                  onRetryTask={handleRetryTask}
                  onDeleteTask={handleDeleteTask}
                />
              </ErrorBoundary>
            } />
            
            <Route path="/settings" element={<Navigate to="/settings/ui" replace />} />
            <Route path="/settings/:tab" element={<SettingsPanelWrapper />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      <FolderPicker 
        isOpen={isFolderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={handleOpenProject}
        initialPath={projectPath}
      />
      <ToastContainer position="bottom-right" autoClose={3000} theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} />
    </div>
  )
}

export default App
