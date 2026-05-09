import figmaIconUrl from "@assets/Figma.svg";
import reactIconUrl from "@assets/React.svg";
import vueIconUrl from "@assets/Vue.svg";
import tailwindIconUrl from "@assets/Tailwind.svg";
import htmlIconUrl from "@assets/Html.svg";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useUiStore } from "@/features/workspace/store/uiStore";
import { useFigmaUrlParser } from "@/features/figma/hooks/useFigmaUrlParser";
import { runConvertFlow } from "@/features/figma/services/runConvertFlow";
import { Brand } from '@/ui/Brand';
import settingIconUrl from "@assets/Setting.svg";
import { WorkspaceSettingsModal } from '@/features/settings';
import { Button } from '@/ui/button';

export function HomePage() {
  const navigate = useNavigate();
  const { state, parse, clearError } = useFigmaUrlParser();
  const [url, setUrl] = useState('');
  const isLoading = state.status === "loading";
  const error = state.status === "error" ? state.error : null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { figmaToken, aiEnhance, modelApiEndpoint, modelApiKey } = useUiStore((s) => ({
    figmaToken: s.figmaToken,
    aiEnhance: s.aiEnhance,
    modelApiEndpoint: s.modelApiEndpoint,
    modelApiKey: s.modelApiKey,
  }));
  const [shouldHighlightFigmaToken, setShouldHighlightFigmaToken] = useState(false);
  const [shouldHighlightModelApi, setShouldHighlightModelApi] = useState(false);

  const handleConvert = async () => {
    if (!figmaToken.trim()) {
      setShouldHighlightFigmaToken(true);
      setShouldHighlightModelApi(false);
      setSettingsOpen(true);
      return;
    }
    if (aiEnhance && (!modelApiEndpoint.trim() || !modelApiKey.trim())) {
      setShouldHighlightFigmaToken(false);
      setShouldHighlightModelApi(true);
      setSettingsOpen(true);
      return;
    }
    setShouldHighlightFigmaToken(false);
    setShouldHighlightModelApi(false);
    const result = await parse(url);
    if (result) {
      await runConvertFlow(result);
      navigate(`/editor`);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#101322] text-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1337EC]/10 blur-[48px]" />
      </div>

      <div className="relative z-10 flex h-[64px] w-full items-center justify-between px-12">
        <Brand />
        <div className="inline-flex items-center rounded-full border border-[#2A2F4C] bg-[#15182A]/70 p-1 shadow-sm backdrop-blur-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-4 text-slate-300 hover:bg-white/5"
            title="Sign in (Coming soon)"
          >
            Sign in
          </Button>
          <div className="mx-1 h-6 w-px bg-white/10" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-white/5 group"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <img
              src={settingIconUrl}
              alt=""
              className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </Button>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex h-[calc(100%-64px)] w-full max-w-5xl flex-col items-center justify-center px-6">
        <div className="text-center text-[48px] font-semibold leading-[56px]">
          <span>Turn your designs into </span>
          <span className="text-[#1337EC]">clean code</span>
          <span>.</span>
        </div>
        <div className="mt-4 max-w-2xl text-center text-lg text-slate-400">
          Paste your Figma link and get production-ready code instantly.
        </div>

        <div className="mt-10 w-full max-w-2xl">
          <div className="relative w-full">
            <div className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <img src={figmaIconUrl} alt="Figma" className="h-4 w-4" />
              )}
            </div>
            <input
              value={url}
              disabled={isLoading}
              onChange={(e) => {
                if (error) clearError();
                setUrl(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleConvert()}
              placeholder={error || "Paste your Figma file URL here..."}
              className="h-[56px] w-full rounded-xl border border-[#2A2F4C] bg-[#15182A] px-12 pr-44 text-base text-slate-200 outline-none ring-1 ring-[#1337EC]/20 focus:ring-[#1337EC]/60"
            />
            <button
              onClick={handleConvert}
              disabled={isLoading}
              className="absolute right-2 top-1/2 h-[44px] -translate-y-1/2 rounded-lg px-6 text-sm font-semibold text-white"
              style={{ backgroundColor: isLoading ? "#4B5563" : "#1337EC" }}
            >
              {isLoading ? "Converting..." : "Convert to Code"}
            </button>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Supported Frameworks
          </div>
          <div className="flex items-center gap-8 text-xs text-slate-500">
            {[
              { label: "React", icon: reactIconUrl },
              { label: "Vue", icon: vueIconUrl },
              { label: "Tailwind", icon: tailwindIconUrl },
              { label: "HTML", icon: htmlIconUrl },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1A1E32]">
                  <img src={item.icon} alt={item.label} className="h-4 w-4" />
                </div>
                <div>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-slate-500">
        © 2026 Figma2Code Inc. All rights reserved.
      </div>

      <WorkspaceSettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setShouldHighlightFigmaToken(false);
          setShouldHighlightModelApi(false);
        }}
        highlightFigmaToken={shouldHighlightFigmaToken}
        highlightModelApiConfig={shouldHighlightModelApi}
      />
    </div>
  );
}
