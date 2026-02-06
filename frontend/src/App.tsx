import { useState, useEffect } from "react";
import "./App.css";
import { Layout } from "./components/layout/Layout";
import { EditorPage } from "./pages/EditorPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DownloaderPage } from "./pages/DownloaderPage";
import { TranscriberPage } from "./pages/TranscriberPage";
import { TranslatorPage } from "./pages/TranslatorPage";
import SettingsPage from "./pages/SettingsPage";

import { TaskProvider } from "./context/TaskContext";

function App() {
  const [activeTab, setActiveTab] = useState("editor");
  
  // Event-based navigation
  useEffect(() => {
    const handleNav = (e: any) => {
        if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('mediaflow:navigate', handleNav);
    return () => window.removeEventListener('mediaflow:navigate', handleNav);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardPage />;
      case "downloader":
        return <DownloaderPage />;
      case "transcriber":
        return <TranscriberPage />;
      case "translator":
        return <TranslatorPage />;
      case "editor":
        return <EditorPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <TaskProvider>
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
    </TaskProvider>
  );
}

export default App;
