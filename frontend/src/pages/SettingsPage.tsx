
import React, { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { Plus, Edit2, Trash2, CheckCircle, X, AlertCircle } from "lucide-react";

interface LLMProvider {
    id: string;
    name: string;
    base_url: string;
    api_key: string;
    model: string;
    is_active: boolean;
}

interface UserSettings {
    llm_providers: LLMProvider[];
    language: string;
}

interface Notification {
    message: string;
    type: "success" | "error";
}

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [openModal, setOpenModal] = useState(false);
    const [notification, setNotification] = useState<Notification | null>(null);
    
    // Form State
    const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
    const [formData, setFormData] = useState<Partial<LLMProvider>>({
        name: "", base_url: "https://api.openai.com/v1", api_key: "", model: "gpt-3.5-turbo"
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const showNotification = (message: string, type: "success" | "error" = "success") => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const fetchSettings = async () => {
        try {
            const data = await apiClient.getSettings();
            setSettings(data);
        } catch (error) {
            console.error("Failed to load settings:", error);
            showNotification("Failed to load settings", "error");
        }
    };

    const handleSaveProvider = async () => {
        if (!settings) return;
        
        const newProviders = [...settings.llm_providers];
        
        if (editingProvider) {
            // Edit existing
            const index = newProviders.findIndex(p => p.id === editingProvider.id);
            if (index !== -1) {
                newProviders[index] = { ...editingProvider, ...formData } as LLMProvider;
            }
        } else {
            // Add new
            const newId = `custom_${Date.now()}`;
            newProviders.push({ 
                id: newId, 
                is_active: false,
                ...formData 
            } as LLMProvider);
        }

        try {
            const res = await apiClient.updateSettings({ ...settings, llm_providers: newProviders });
            setSettings(res);
            setOpenModal(false);
            showNotification("Provider saved");
        } catch (error) {
            showNotification("Failed to save", "error");
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!settings) return;
        if (!confirm("Are you sure?")) return;
        
        const newProviders = settings.llm_providers.filter(p => p.id !== id);
        try {
            const res = await apiClient.updateSettings({ ...settings, llm_providers: newProviders });
            setSettings(res);
            showNotification("Deleted");
        } catch (error) {
            showNotification("Failed to delete", "error");
        }
    };
    
    const handleSetActive = async (id: string) => {
        try {
            await apiClient.setActiveProvider(id);
            await fetchSettings(); // Reload to see update
            showNotification("Active provider updated");
        } catch (error) {
            showNotification("Failed to set active", "error");
        }
    };

    const openAdd = () => {
        setEditingProvider(null);
        setFormData({ name: "New Provider", base_url: "https://api.openai.com/v1", api_key: "", model: "gpt-4o" });
        setOpenModal(true);
    };

    const openEdit = (provider: LLMProvider) => {
        setEditingProvider(provider);
        setFormData(provider);
        setOpenModal(true);
    };

    // Styles
    const inputStyle = {
        width: "100%",
        padding: "8px 12px",
        background: "#333",
        border: "1px solid #555",
        borderRadius: "4px",
        color: "#fff",
        marginBottom: "10px"
    };

    const labelStyle = {
        display: "block",
        fontSize: "0.85em",
        color: "#aaa",
        marginBottom: "4px"
    };

    const buttonStyle = {
        padding: "8px 16px",
        borderRadius: "4px",
        border: "none",
        cursor: "pointer",
        fontWeight: 500
    };

    return (
        <div style={{ padding: "30px", color: "#e5e5e5", height: "100%", overflowY: "auto", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
                <h2 style={{ margin: 0, fontSize: "1.8em" }}>Settings</h2>
                <button 
                    onClick={openAdd}
                    style={{ ...buttonStyle, background: "#4F46E5", color: "white", display: "flex", alignItems: "center", gap: "6px" }}
                >
                    <Plus size={18} /> Add Provider
                </button>
            </div>

            <div style={{ background: "#1e1e1e", borderRadius: "8px", border: "1px solid #333", overflow: "hidden" }}>
                <div style={{ padding: "15px 20px", borderBottom: "1px solid #333", display: "flex", gap: "20px" }}>
                    <div style={{ paddingBottom: "10px", borderBottom: "2px solid #4F46E5", color: "#fff", fontWeight: 500, cursor: "pointer" }}>LLM Providers</div>
                    <div style={{ paddingBottom: "10px", color: "#666", cursor: "not-allowed" }}>General</div>
                </div>
                
                <div style={{ padding: "0" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", color: "#ddd" }}>
                        <thead>
                            <tr style={{ textAlign: "left", background: "#252525", fontSize: "0.9em", color: "#aaa" }}>
                                <th style={{ padding: "12px 20px" }}>Status</th>
                                <th style={{ padding: "12px 20px" }}>Name</th>
                                <th style={{ padding: "12px 20px" }}>Model</th>
                                <th style={{ padding: "12px 20px" }}>Base URL</th>
                                <th style={{ padding: "12px 20px", textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settings?.llm_providers.map((provider) => (
                                <tr key={provider.id} style={{ borderBottom: "1px solid #333" }}>
                                    <td style={{ padding: "12px 20px" }}>
                                        {provider.is_active ? (
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8em" }}>
                                                <CheckCircle size={12} /> Active
                                            </span>
                                        ) : (
                                            <button 
                                                onClick={() => handleSetActive(provider.id)}
                                                style={{ background: "transparent", border: "1px solid #555", color: "#aaa", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8em", cursor: "pointer" }}
                                            >
                                                Set Active
                                            </button>
                                        )}
                                    </td>
                                    <td style={{ padding: "12px 20px", fontWeight: 500 }}>{provider.name}</td>
                                    <td style={{ padding: "12px 20px", fontFamily: "monospace", color: "#818cf8" }}>{provider.model}</td>
                                    <td style={{ padding: "12px 20px", fontSize: "0.9em", color: "#888" }}>{provider.base_url}</td>
                                    <td style={{ padding: "12px 20px", textAlign: "right" }}>
                                        <button onClick={() => openEdit(provider)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", marginRight: "10px" }} title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(provider.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }} title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {(!settings?.llm_providers || settings.llm_providers.length === 0) && (
                                <tr>
                                    <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#666" }}>No providers configured</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Overlay */}
            {openModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                    <div style={{ background: "#222", padding: "25px", borderRadius: "8px", width: "450px", border: "1px solid #444", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <h3 style={{ margin: 0 }}>{editingProvider ? "Edit Provider" : "Add Provider"}</h3>
                            <button onClick={() => setOpenModal(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div>
                            <label style={labelStyle}>Display Name</label>
                            <input 
                                style={inputStyle}
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. My DeepSeek"
                            />
                            
                            <label style={labelStyle}>Base URL</label>
                            <input 
                                style={inputStyle}
                                value={formData.base_url}
                                onChange={(e) => setFormData({...formData, base_url: e.target.value})}
                                placeholder="https://api.openai.com/v1"
                            />
                            
                            <label style={labelStyle}>API Key</label>
                            <input 
                                style={inputStyle}
                                type="password"
                                value={formData.api_key}
                                onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                                placeholder="sk-..."
                            />
                            
                            <label style={labelStyle}>Model Name</label>
                            <input 
                                style={inputStyle}
                                value={formData.model}
                                onChange={(e) => setFormData({...formData, model: e.target.value})}
                                placeholder="e.g. gpt-4o, deepseek-chat"
                            />
                        </div>
                        
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                            <button 
                                onClick={() => setOpenModal(false)}
                                style={{ ...buttonStyle, background: "transparent", color: "#ccc", border: "1px solid #555" }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveProvider}
                                style={{ ...buttonStyle, background: "#4F46E5", color: "white" }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Toast Notification */}
            {notification && (
                <div style={{ 
                    position: "fixed", 
                    bottom: 20, 
                    right: 20, 
                    background: notification.type === 'error' ? '#ef4444' : '#10b981',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    zIndex: 2000,
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <span style={{ fontWeight: 500 }}>{notification.message}</span>
                </div>
            )}
            
            <style>{`
                @keyframes slideIn {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default SettingsPage;
