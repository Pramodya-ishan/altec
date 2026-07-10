with open("src/components/layout/TopNav.tsx", "r") as f:
    c = f.read()

old = """          {/* Sync Indicator */}
          <div className={cn(
            "hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all",
            syncStatus === 'Cloud' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
            syncStatus === 'Syncing' ? "bg-amber-50 text-amber-600 border-amber-200" :
            "bg-slate-50 text-slate-500 border-slate-200"
          )} title="Storage Status">
            {syncStatus === 'Cloud' && <Cloud className="w-4 h-4" />}
            {syncStatus === 'Syncing' && <RefreshCw className="w-4 h-4 animate-spin" />}
            {syncStatus === 'Local' && <HardDrive className="w-4 h-4" />}
            {syncStatus !== 'Cloud' && <span>{syncStatus}</span>}
          </div>"""

c = c.replace(old, "")

with open("src/components/layout/TopNav.tsx", "w") as f:
    f.write(c)
