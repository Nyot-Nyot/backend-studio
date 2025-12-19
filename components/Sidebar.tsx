import React, { useState } from 'react';
import { LayoutDashboard, Activity, Settings, FolderPlus, ChevronDown, Check, X, FlaskConical, Sparkles, Trash2, PenTool, Box, PanelLeftClose, PanelLeftOpen, Search, Rocket, Database } from 'lucide-react';
import { ViewState, Project } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onNewMock: () => void;
  onMagicCreate: () => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onTriggerCommandPalette: () => void;
  onDeploy: () => void; 
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onChangeView, 
  onNewMock,
  onMagicCreate,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onTriggerCommandPalette,
  onDeploy
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItemClass = (view: ViewState) =>
    `relative flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-xl transition-all duration-200 cursor-pointer group ${
      currentView === view
        ? 'bg-slate-800 text-white shadow-lg shadow-black/20'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`;

  const activeIndicator = (view: ViewState) => 
    currentView === view && (
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-r-full shadow-[0_0_12px_rgba(14,165,233,0.6)] animate-in fade-in duration-300 ${isCollapsed ? 'h-4' : 'h-6'}`} />
    );

  const handleCreateSubmit = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateSubmit();
    if (e.key === 'Escape') {
      setIsCreating(false);
      setNewProjectName('');
    }
  };

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} bg-slate-900 h-screen flex flex-col flex-shrink-0 text-slate-300 border-r border-slate-800 shadow-2xl z-30 transition-all duration-300 ease-in-out relative`}>
      
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-slate-800 text-slate-400 border border-slate-700 rounded-full p-1 hover:text-white hover:bg-slate-700 transition-colors shadow-sm z-50"
      >
        {isCollapsed ? <PanelLeftOpen className="w-3 h-3" /> : <PanelLeftClose className="w-3 h-3" />}
      </button>

      {/* Brand Header */}
      <div className={`p-6 pb-8 flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} transition-all`}>
        <div className="p-2.5 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl shadow-lg shadow-brand-900/20 ring-1 ring-white/10 flex-shrink-0">
           <Box className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        {!isCollapsed && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300 overflow-hidden whitespace-nowrap">
             <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-1">Backend Studio</h1>
             <p className="text-[11px] text-brand-400 font-medium tracking-wide uppercase opacity-90">Design & Prototype</p>
          </div>
        )}
      </div>

      {/* Project Selector & Search */}
      <div className={`px-6 mb-6 ${isCollapsed ? 'px-3 flex flex-col items-center' : ''}`}>
        {!isCollapsed ? (
            <>
                <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workspace</span>
                {projects.length > 1 && (
                    <button 
                    onClick={() => onDeleteProject(activeProjectId)}
                    className="text-slate-600 hover:text-red-400 transition-colors p-1 hover:bg-slate-800 rounded"
                    title="Delete current workspace"
                    >
                    <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
                </div>
                
                <div className="relative group mb-3">
                <select
                    value={activeProjectId}
                    onChange={(e) => onSelectProject(e.target.value)}
                    className="w-full appearance-none bg-slate-800 text-slate-200 border border-slate-700/50 group-hover:border-slate-600 rounded-xl py-2.5 pl-3.5 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all cursor-pointer shadow-sm"
                >
                    {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-slate-300 transition-colors">
                    <ChevronDown className="w-4 h-4" />
                </div>
                </div>

                <button
                    onClick={onTriggerCommandPalette}
                    className="w-full flex items-center space-x-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 py-2 px-3 rounded-lg text-xs transition-colors border border-slate-800 hover:border-slate-700 mb-4 group"
                >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search...</span>
                    <span className="ml-auto text-[10px] bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 group-hover:text-slate-400 font-mono">⌘K</span>
                </button>
            </>
        ) : (
            <div className="mb-6 w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 font-bold border border-slate-700">
                {projects.find(p => p.id === activeProjectId)?.name.charAt(0)}
            </div>
        )}

        {isCreating && !isCollapsed ? (
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-200">
            <input
              autoFocus
              type="text"
              placeholder="Workspace Name"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-brand-500 outline-none mb-3 transition-colors placeholder:text-slate-600"
            />
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleCreateSubmit} 
                disabled={!newProjectName.trim()}
                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 rounded-lg transition-all shadow-sm active:scale-95 flex items-center justify-center"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" /> Create
              </button>
              <button 
                onClick={() => setIsCreating(false)} 
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
            !isCollapsed && (
            <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center space-x-2 bg-transparent hover:bg-slate-800 text-slate-500 hover:text-slate-300 py-2 px-3 rounded-lg text-xs font-medium transition-all border border-dashed border-slate-700 hover:border-slate-600 group"
            >
                <FolderPlus className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                <span>New Workspace</span>
            </button>
            )
        )}
      </div>

      <div className={`px-4 space-y-8 flex-1 overflow-y-auto dark-scroll ${isCollapsed ? 'px-2' : ''}`}>
        {/* Actions */}
        <div className="space-y-3">
           <button
            onClick={onNewMock}
            title={isCollapsed ? "Design Route" : ""}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-center space-x-3'} bg-slate-800 hover:bg-slate-700 text-white py-3 px-4 rounded-xl transition-all shadow-sm hover:shadow-md border border-slate-700 hover:border-slate-600 group active:scale-95`}
          >
            <PenTool className="w-4 h-4 text-brand-400 group-hover:text-brand-300" />
            {!isCollapsed && <span className="font-medium text-sm">Design Route</span>}
          </button>
          
          <button
            onClick={onMagicCreate}
            title={isCollapsed ? "AI Architect" : ""}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-center space-x-3'} bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-900/20 hover:shadow-indigo-900/40 group relative overflow-hidden active:scale-95`}
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <Sparkles className="w-4 h-4 text-violet-200 group-hover:text-white transition-colors" />
            {!isCollapsed && <span className="font-medium text-sm relative z-10">AI Architect</span>}
          </button>
        </div>

        {/* Navigation */}
        <div className="space-y-1.5">
          {!isCollapsed && (
            <div className="px-2 mb-2 animate-in fade-in duration-300">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Main Menu</span>
            </div>
          )}
          <nav className="space-y-1">
            <div onClick={() => onChangeView('dashboard')} className={navItemClass('dashboard')} title="Overview">
              {activeIndicator('dashboard')}
              <LayoutDashboard className={`w-5 h-5 ${currentView === 'dashboard' ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {!isCollapsed && <span className="font-medium">Overview</span>}
            </div>
            <div onClick={() => onChangeView('test')} className={navItemClass('test')} title="Prototype Lab">
              {activeIndicator('test')}
              <FlaskConical className={`w-5 h-5 ${currentView === 'test' ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {!isCollapsed && <span className="font-medium">Prototype Lab</span>}
            </div>
            <div onClick={() => onChangeView('database')} className={navItemClass('database')} title="Database">
              {activeIndicator('database')}
              <Database className={`w-5 h-5 ${currentView === 'database' ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {!isCollapsed && <span className="font-medium">Database</span>}
            </div>
            <div onClick={() => onChangeView('logs')} className={navItemClass('logs')} title="Traffic Monitor">
              {activeIndicator('logs')}
              <Activity className={`w-5 h-5 ${currentView === 'logs' ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {!isCollapsed && <span className="font-medium">Traffic Monitor</span>}
            </div>
             <div onClick={() => onChangeView('settings')} className={navItemClass('settings')} title="Configuration">
              {activeIndicator('settings')}
              <Settings className={`w-5 h-5 ${currentView === 'settings' ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {!isCollapsed && <span className="font-medium">Configuration</span>}
            </div>
            <div onClick={() => onChangeView('externalApi')} className={navItemClass('externalApi')} title="External API">
              {activeIndicator('externalApi')}
              <Rocket className={`w-5 h-5 ${currentView === 'externalApi' ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {!isCollapsed && <span className="font-medium">External API</span>}
            </div>
          </nav>
        </div>

        {/* Deploy Button Area */}
        <div className="mt-auto pt-6">
            <button
                onClick={onDeploy}
                title={isCollapsed ? "Export Server" : ""}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 px-4'} py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all group`}
            >
                <Rocket className="w-5 h-5 text-emerald-500" />
                {!isCollapsed && (
                    <div className="text-left">
                        <span className="block text-xs font-bold uppercase tracking-wider text-emerald-400">Export Server</span>
                        <span className="block text-[10px] text-emerald-600/80">Node.js Runtime</span>
                    </div>
                )}
            </button>
        </div>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="flex items-center space-x-3 text-xs text-slate-500 px-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="font-mono opacity-70">System Ready</span>
            </div>
        </div>
      )}
    </div>
  );
};