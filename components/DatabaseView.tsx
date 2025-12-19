import React, { useState, useEffect } from "react";
import {
  Database,
  Trash2,
  RefreshCw,
  Plus,
  Save,
  Search,
  Table,
  X,
} from "lucide-react";
import { dbService } from "../services/dbService";

export const DatabaseView = () => {
  const [collections, setCollections] = useState<string[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [rawEditor, setRawEditor] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCollections = () => {
    const cols = dbService.listCollections();
    setCollections(cols);
    if (!activeCollection && cols.length > 0) {
      handleSelectCollection(cols[0]);
    }
  };

  const handleSelectCollection = (name: string) => {
    setActiveCollection(name);
    const colData = dbService.getCollection(name);
    setData(colData);
    setRawEditor(JSON.stringify(colData, null, 2));
    setIsEditing(false);
    setError(null);
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const handleRefresh = () => {
    if (activeCollection) handleSelectCollection(activeCollection);
    loadCollections();
  };

  const handleClearCollection = () => {
    if (
      activeCollection &&
      window.confirm(`Clear all data in '${activeCollection}'?`)
    ) {
      dbService.clearCollection(activeCollection);
      handleRefresh();
    }
  };

  const handleDeleteItem = (index: number) => {
    if (activeCollection && data[index]) {
      const item = data[index];
      const itemId = item.id ?? `(index ${index})`;
      if (window.confirm(`Delete item ${itemId}?`)) {
        const newData = data.filter((_, i) => i !== index);
        dbService.saveCollection(activeCollection, newData);
        setData(newData);
      }
    }
  };

  const handleClearAllDB = () => {
    if (
      window.confirm("Delete ALL collections and data? This cannot be undone.")
    ) {
      dbService.clearAllCollections();
      setCollections([]);
      setActiveCollection(null);
      setData([]);
      setRawEditor("");
    }
  };

  const handleSave = () => {
    if (!activeCollection) return;
    try {
      const parsed = JSON.parse(rawEditor);
      if (!Array.isArray(parsed)) throw new Error("Data must be an array");
      dbService.saveCollection(activeCollection, parsed);
      setData(parsed);
      setIsEditing(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col animate-in fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Database className="w-6 h-6 mr-3 text-brand-500" />
            Memory Store
          </h1>
          <p className="text-slate-500 mt-1">
            View and manage the stateful data for your active endpoints.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleClearAllDB}
            className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
            title="Clear all collections"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Sidebar List */}
        <div className="col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Collections
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {collections.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">
                No active data buckets. Enable "Stateful" on an endpoint to
                create one.
              </div>
            ) : (
              collections.map((col) => (
                <button
                  key={col}
                  onClick={() => handleSelectCollection(col)}
                  className={`w-full text-left px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-all flex items-center justify-between ${
                    activeCollection === col
                      ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{col}</span>
                  {activeCollection === col && (
                    <div className="w-2 h-2 rounded-full bg-brand-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="col-span-9 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {activeCollection ? (
            <>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-slate-400" />
                  <span className="font-mono text-sm font-bold text-slate-700">
                    {activeCollection}
                  </span>
                  <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">
                    {data.length} records
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setRawEditor(JSON.stringify(data, null, 2));
                          setError(null);
                        }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5 mr-1.5" /> Save Changes
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        Edit Raw JSON
                      </button>
                      <button
                        onClick={handleClearCollection}
                        className="text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
                        title="Clear Data"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 relative">
                {isEditing ? (
                  <textarea
                    value={rawEditor}
                    onChange={(e) => setRawEditor(e.target.value)}
                    className="w-full h-full p-4 font-mono text-sm text-slate-700 bg-slate-50 focus:outline-none resize-none"
                  />
                ) : (
                  <div className="p-0 h-full overflow-y-auto">
                    {data.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <p className="text-sm">Collection is empty.</p>
                        <p className="text-xs mt-1">
                          POST requests to this endpoint will populate this
                          list.
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 shadow-sm">
                          <tr>
                            {Object.keys(data[0] || {})
                              .slice(0, 5)
                              .map((key) => (
                                <th
                                  key={key}
                                  className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200"
                                >
                                  {key}
                                </th>
                              ))}
                            <th className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-12">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {data.map((row, i) => (
                            <tr
                              key={i}
                              className="border-b border-slate-100 hover:bg-slate-50/50 font-mono text-xs"
                            >
                              {Object.keys(data[0] || {})
                                .slice(0, 5)
                                .map((key) => (
                                  <td
                                    key={key}
                                    className="p-3 text-slate-600 truncate max-w-[200px]"
                                  >
                                    {typeof row[key] === "object"
                                      ? JSON.stringify(row[key])
                                      : String(row[key])}
                                  </td>
                                ))}
                              <td className="p-3 w-12">
                                <button
                                  onClick={() => handleDeleteItem(i)}
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                  title="Delete item"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                {error && (
                  <div className="absolute bottom-4 left-4 right-4 bg-red-100 text-red-700 p-3 rounded-lg text-sm border border-red-200 shadow-lg flex items-center">
                    <span className="font-bold mr-2">Error:</span> {error}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Database className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a collection to view data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
