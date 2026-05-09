import settingIconUrl from '@assets/Setting.svg';
import { type CSSProperties } from 'react';
import { Link2, KeyRound, X } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { useWorkspaceSettingsModalState } from '../hooks/useWorkspaceSettingsModalState';

const maskedTextStyle = { WebkitTextSecurity: 'disc' } as CSSProperties;

interface WorkspaceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  highlightFigmaToken?: boolean;
  highlightModelApiConfig?: boolean;
}

export function WorkspaceSettingsModal({
  open,
  onClose,
  highlightFigmaToken,
  highlightModelApiConfig,
}: WorkspaceSettingsModalProps) {
  const {
    framework,
    setFramework,
    stylingSystem,
    setStylingSystem,
    apiEndpoint,
    setApiEndpoint,
    apiKey,
    setApiKey,
    modelNameDraft,
    setModelNameDraft,
    aiEnhanceDraft,
    setAiEnhanceDraft,
    figmaTokenDraft,
    setFigmaTokenDraft,
    figmaTokenInputRef,
    figmaTokenInvalid,
    setFigmaTokenTouched,
    setModelApiEndpointTouched,
    setModelApiKeyTouched,
    modelApiEndpointInputRef,
    modelApiKeyInputRef,
    modelApiEndpointInvalid,
    modelApiKeyInvalid,
    handleSave,
  } = useWorkspaceSettingsModalState({
    open,
    onClose,
    highlightFigmaToken,
    highlightModelApiConfig,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="h-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <img src={settingIconUrl} alt="" className="w-5 h-5" style={{ filter: 'brightness(0) invert(0.7)' }} />
            <DialogTitle>Workspace Settings</DialogTitle>
          </div>
          <DialogDescription className="sr-only">Configure workspace settings.</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" type="button">
              <X className="h-4 w-4 text-[#9CA3AF]" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
        <DialogBody className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-3">
            <div className="text-[#E5E7EB] text-sm leading-5 font-medium uppercase tracking-[0.07em] font-['Inter']">
              Preset Options
            </div>
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-1.5">
                <Label>Framework</Label>
                <Select value={framework} onValueChange={setFramework}>
                  <SelectTrigger disabled>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HTML + CSS">HTML + CSS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <Label>Styling System</Label>
                <Select value={stylingSystem} onValueChange={setStylingSystem}>
                  <SelectTrigger disabled>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CSS">CSS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="text-[#E5E7EB] text-sm leading-5 font-medium uppercase tracking-[0.07em] font-['Inter']">
              Figma
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Figma Token</Label>
              <Input
                type="text"
                ref={figmaTokenInputRef}
                value={figmaTokenDraft}
                onChange={(e) => setFigmaTokenDraft(e.target.value)}
                placeholder="figd_..."
                autoComplete="off"
                style={maskedTextStyle}
                onBlur={() => setFigmaTokenTouched(true)}
                className={figmaTokenInvalid ? 'border-red-500/70 focus-visible:ring-red-500/40' : undefined}
              />
              {figmaTokenInvalid && (
                <div className="text-[11px] leading-[16px] text-red-400">Figma Token 是必填项</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="text-[#E5E7EB] text-sm leading-5 font-medium uppercase tracking-[0.07em] font-['Inter']">
              Model API Configuration
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Model API Endpoint URL</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
                  <Input
                    ref={modelApiEndpointInputRef}
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder="https://your-llm-api.example/v1"
                    autoComplete="off"
                    onBlur={() => setModelApiEndpointTouched(true)}
                    aria-invalid={modelApiEndpointInvalid}
                    className={`pl-9 ${modelApiEndpointInvalid ? 'border-red-500/70 focus-visible:ring-red-500/40' : ''}`}
                  />
                </div>
                {modelApiEndpointInvalid && (
                  <div className="text-[11px] leading-[16px] text-red-400">Model API Endpoint 是必填项</div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Model</Label>
                <Input
                  value={modelNameDraft}
                  onChange={(e) => setModelNameDraft(e.target.value)}
                  placeholder="gpt-4o"
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Model API Key</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
                  <Input
                    type="text"
                    ref={modelApiKeyInputRef}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                    style={maskedTextStyle}
                    onBlur={() => setModelApiKeyTouched(true)}
                    aria-invalid={modelApiKeyInvalid}
                    className={`pl-9 ${modelApiKeyInvalid ? 'border-red-500/70 focus-visible:ring-red-500/40' : ''}`}
                  />
                </div>
                {modelApiKeyInvalid && (
                  <div className="text-[11px] leading-[16px] text-red-400">Model API Key 是必填项</div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#2A2F4C] flex flex-col gap-4">
            <div className="text-[#E5E7EB] text-sm leading-5 font-medium uppercase tracking-[0.07em] font-['Inter']">
              AI Features
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-[#D1D5DB] text-sm leading-5 font-medium font-['Inter']">AI Enhance</div>
                <div className="px-1.5 py-0.5 rounded bg-gradient-to-r from-[#9333EA] to-[#4F46E5] shadow-sm text-white text-[10px] leading-[15px] font-bold font-['Inter']">
                  BETA
                </div>
              </div>
              <Switch checked={aiEnhanceDraft} onCheckedChange={setAiEnhanceDraft} />
            </div>
            <div className="text-[#9CA3AF] text-[11px] leading-[16.5px] font-normal font-['Inter']">
              Automatically refactor and optimize generated code using our advanced AI models.
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
