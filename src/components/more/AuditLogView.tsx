import React, { useState } from 'react';
import { Shield, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { AuditLogEntry } from '../../types';

export const AuditLogView: React.FC<{ auditLogs: AuditLogEntry[] }> = ({ auditLogs }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedAuditLogs = [...auditLogs].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#EC4899]" />
          Immutable Audit Event Log
        </h3>
        <p className="text-xs text-slate-500 dark:text-[#8899BB]">Banking-grade actor activity & state change diffs</p>
      </div>

      <div className="space-y-2">
        {sortedAuditLogs.map((log) => {
          const isExpanded = expandedId === log.id;
          return (
            <div
              key={log.id}
              className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-[#1E2D40] rounded-2xl p-3.5 space-y-2 cursor-pointer shadow-sm"
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#EC4899]/20 text-[#EC4899] flex items-center justify-center font-mono font-bold text-xs">
                    AUD
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      <span className="text-teal-600 dark:text-[#00D4AA]">{log.actorName}</span> performed <span className="font-mono text-[#EC4899]">{log.action}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-[#8899BB] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString()} • {log.branch}
                    </p>
                  </div>
                </div>

                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-[#8899BB]" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-[#8899BB]" />}
              </div>

              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-[#1E2D40] bg-slate-50 dark:bg-[#0A0E1A] p-2.5 rounded-xl text-xs space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-[#8899BB] uppercase">Recorded State Change:</p>
                  <pre className="text-[10px] font-mono text-teal-600 dark:text-[#00D4AA] overflow-x-auto p-1 bg-slate-100 dark:bg-[#1C2333] rounded">
                    {JSON.stringify(log.diffAfter || log.diffBefore || { status: 'Recorded' }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
