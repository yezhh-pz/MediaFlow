import { useState } from "react";
import "./App.css";
import { Layout } from "./components/layout/Layout";
import { EditorPage } from "./pages/EditorPage";
import { DownloaderPage } from "./pages/DownloaderPage";
import { TranscriberPage } from "./pages/TranscriberPage";
import { TranslatorPage } from "./pages/TranslatorPage";

import { TaskProvider } from "./context/TaskContext";

function App() {
  const [activeTab, setActiveTab] = useState("editor");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <div><h1>📊 Dashboard</h1><p>Running pipelines will appear here.</p></div>;
      case "downloader":
        return <DownloaderPage />;
      case "transcriber":
        return <TranscriberPage />;
      case "translator":
        return <TranslatorPage />;
      case "editor":
        return <EditorPage />;
      case "settings":
        return <div><h1>⚙️ Settings</h1><p>Global configuration.</p></div>;
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
