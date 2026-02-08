import React, { useState } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { CheckCircle, AlertCircle, Loader, Clock, Pause, Play, Trash2, FolderOpen, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { TaskTraceView } from './TaskTraceView';

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{ width: '100%', height: 6, background: '#333', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
    <div 
      style={{ 
        width: `${Math.max(0, Math.min(100, progress))}%`, 
        height: '100%', 
        background: '#4F46E5',
        transition: 'width 0.3s ease'
      }} 
    />
  </div>
);

export const TaskMonitor: React.FC<{ filterTypes?: string[] }> = ({ filterTypes }) => {
    const { tasks, cancelTask, connected } = useTaskContext();
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

    const filteredTasks = React.useMemo(() => {
        if (!filterTypes || filterTypes.length === 0) return tasks;
        return tasks.filter(t => filterTypes.includes(t.type));
    }, [tasks, filterTypes]);

    const toggleExpand = (taskId: string) => {
        setExpandedTasks(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    if (filteredTasks.length === 0) {
        return null; // Or show empty state?
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle size={18} color="#10b981" />;
            case 'failed': return <AlertCircle size={18} color="#ef4444" />;
            case 'running': return <Loader size={18} className="spin" color="#4F46E5" />;
            case 'pending': return <Clock size={18} color="#f59e0b" />;
            case 'cancelled': return <Pause size={18} color="#f59e0b" />; // Use Pause icon for cancelled state
            default: return null;
        }
    };

    return (
        <div className="card" style={{ 
            background: '#1e1e1e', 
            borderRadius: 12, 
            border: '1px solid #333',
            marginTop: 30,
            overflow: 'hidden'
        }}>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Task Monitor</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '0.8em', color: connected ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }} />
                        {connected ? 'Connected' : 'Disconnected'}
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                    {/* Pause All */}
                    <button 
                        onClick={() => {
                            if (confirm('Pause all running tasks?')) {
                                import('../api/client').then(({ apiClient }) => {
                                    apiClient.cancelAllTasks().catch(err => console.error(err));
                                });
                            }
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#333',
                            border: '1px solid #555',
                            color: '#ccc',
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '0.9em'
                        }}
                        title="Pause all active downloads (Can be resumed)"
                    >
                        <Pause size={14} />
                        Pause All
                    </button>

                    {/* Clear All (Delete All) */}
                    <button 
                        onClick={() => {
                            if (confirm('Delete ALL tasks? This cannot be undone.')) {
                                import('../api/client').then(({ apiClient }) => {
                                    apiClient.deleteAllTasks().catch(err => console.error(err));
                                });
                            }
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: '#333',
                            border: '1px solid #555',
                            color: '#ef4444', // Red color for danger
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '0.9em'
                        }}
                        title="Delete and clear all tasks"
                    >
                        <Trash2 size={14} />
                        Clear All
                    </button>
                </div>
                </div>
            </div>
            
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filteredTasks.map(task => (
                    <div key={task.id} style={{ padding: '15px 20px', borderBottom: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {getStatusIcon(task.status)}
                                <span style={{ fontWeight: 500 }}>
                                    {task.name || (task.type === 'download' ? 'Downloading' : 'Task')} 
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {task.status === 'running' || task.status === 'pending' ? (
                                    <button 
                                        onClick={() => cancelTask(task.id)}
                                        title="Pause task (Resumable)"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                                    >
                                        <Pause size={16} color="#6b7280" />
                                    </button>
                                ) : null}

                                {(task.status === 'cancelled' || task.status === 'failed' || task.status === 'paused') && (
                                    <button 
                                         onClick={() => {
                                            import('../api/client').then(({ apiClient }) => {
                                                apiClient.resumeTask(task.id).catch(err => console.error(err));
                                            });
                                        }}
                                        title="Resume download"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                                    >
                                        <Play size={16} color="#10b981" />
                                    </button>
                                )}

                                 {/* Delete Button - Always visible or for finished/stopped tasks? */}
                                 {/* User wants "Cancel" (Delete). So we show it always. */}
                                 {/* For running tasks, it cancels then deletes (backend handles this). */}
                                 <button
                                    onClick={() => {
                                        if (confirm("Delete this task? This will remove it from the list.")) {
                                            import('../api/client').then(({ apiClient }) => {
                                                apiClient.deleteTask(task.id).catch(err => console.error(err));
                                            });
                                        }
                                    }}
                                    title="Delete task (Remove from list)"
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                                >
                                    <Trash2 size={16} color="#6b7280" />
                                </button>
                                
                                {/* Open Folder Button for Completed Downloads */}
                                {task.status === 'completed' && task.result?.video_path && (
                                    <button
                                        onClick={() => {
                                             const path = task.result.video_path;
                                             if ((window as any).electronAPI) {
                                                 (window as any).electronAPI.showInExplorer(path);
                                             } else {
                                                 alert(`File path: ${path}`);
                                             }
                                        }}
                                        title="Show file in folder"
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 4 }}
                                    >
                                        <FolderOpen size={16} color="#3b82f6" />
                                    </button>
                                )}

                                {/* Smart Navigation: Next Step Buttons */}
                                {task.status === 'completed' && (task.result?.video_path || task.result?.path) && (
                                    <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
                                        {/* Transcribe Button */}
                                        <button
                                            onClick={() => {
                                                const subPath = task.result?.subtitle_path || task.result?.srt_path;
                                                sessionStorage.setItem('mediaflow:pending_file', JSON.stringify({
                                                    video_path: task.result?.video_path || task.result?.path,
                                                    subtitle_path: subPath // Pass it if exists, Transcriber can ignore or use it
                                                }));
                                                window.dispatchEvent(new CustomEvent('mediaflow:navigate', { detail: 'transcriber' }));
                                            }}
                                            title="Open in Transcriber"
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: 4,
                                                background: '#4F46E5', // Indigo
                                                border: 'none', 
                                                cursor: 'pointer', 
                                                padding: '4px 8px',
                                                borderRadius: 4,
                                                color: '#fff',
                                                fontSize: '0.75em'
                                            }}
                                        >
                                            Transcribe
                                            <ArrowRight size={12} />
                                        </button>

                                        {/* Translate Button */}
                                        <button
                                            onClick={() => {
                                                const subPath = task.result?.subtitle_path || task.result?.srt_path;
                                                if (!subPath) return;

                                                sessionStorage.setItem('mediaflow:pending_file', JSON.stringify({
                                                    video_path: task.result?.video_path || task.result?.path,
                                                    subtitle_path: subPath
                                                }));
                                                window.dispatchEvent(new CustomEvent('mediaflow:navigate', { detail: 'translator' }));
                                            }}
                                            disabled={!task.result?.subtitle_path && !task.result?.srt_path}
                                            title={task.result?.subtitle_path || task.result?.srt_path ? 'Open in Translator' : 'No subtitle found'}
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: 4,
                                                background: (task.result?.subtitle_path || task.result?.srt_path) ? '#10b981' : '#374151', // Emerald or Gray-700
                                                border: 'none', 
                                                cursor: (task.result?.subtitle_path || task.result?.srt_path) ? 'pointer' : 'not-allowed',
                                                padding: '4px 8px',
                                                borderRadius: 4,
                                                color: (task.result?.subtitle_path || task.result?.srt_path) ? '#fff' : '#9ca3af', // White or Gray-400
                                                fontSize: '0.75em',
                                                opacity: (task.result?.subtitle_path || task.result?.srt_path) ? 1 : 0.8
                                            }}
                                        >
                                            Translate
                                            <ArrowRight size={12} />
                                        </button>
                                    </div>
                                )}

                                {/* Expand/Collapse Trace */}
                                {task.result?.execution_trace && (
                                    <button 
                                        onClick={() => toggleExpand(task.id)}
                                        title={expandedTasks.has(task.id) ? "Hide Details" : "Show Details"}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                                    >
                                        {expandedTasks.has(task.id) ? <ChevronUp size={16} color="#aaa" /> : <ChevronDown size={16} color="#aaa" />}
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: 5, paddingLeft: 28 }}>
                            {task.message || 'Initializing...'}
                        </div>
                        
                        {(task.status === 'running' || task.progress > 0) && (
                            <div style={{ paddingLeft: 28 }}>
                                <ProgressBar progress={task.progress} />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75em', color: '#666', marginTop: 4 }}>
                                    {task.progress.toFixed(1)}%
                                </div>
                            </div>
                        )}
                        
                        {task.error && (
                            <div style={{ fontSize: '0.85em', color: '#ef4444', marginTop: 5, paddingLeft: 28 }}>
                                {task.error}
                            </div>
                        )}

                        {/* Execution Trace View */}
                        {expandedTasks.has(task.id) && task.result?.execution_trace && (
                            <div style={{ paddingLeft: 28 }}>
                                <TaskTraceView trace={task.result.execution_trace} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};
