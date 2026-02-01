import React from 'react';
import { TaskMonitor } from '../components/TaskMonitor';
import { Activity, Server } from 'lucide-react';

export const DashboardPage = () => {
    return (
        <div className="container mx-auto p-6 max-w-5xl">
            <header className="mb-8 flex items-center gap-3">
                <div className="p-3 bg-indigo-500/20 rounded-xl">
                    <Activity className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400">System overview and active tasks</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* System Stats (Placeholder for now) */}
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <Server className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-semibold text-slate-200">System Status</h3>
                    </div>
                    <div className="text-sm text-slate-400">
                         <div className="flex justify-between py-1">
                             <span>Backend</span>
                             <span className="text-emerald-400">Online</span>
                         </div>
                         <div className="flex justify-between py-1">
                             <span>Worker Threads</span>
                             <span className="text-slate-200">Auto</span>
                         </div>
                    </div>
                </div>
                
                {/* Add more widgets here later */}
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-200">Active Tasks</h2>
                {/* Global Monitor - Shows all tasks */}
                <TaskMonitor />
            </div>
        </div>
    );
};
