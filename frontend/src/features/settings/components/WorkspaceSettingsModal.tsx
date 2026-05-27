import { type CSSProperties } from 'react';
import { Settings2, X } from 'lucide-react';
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
import { useWorkspaceSettingsModalState } from '../hooks/useWorkspaceSettingsModalState';
import { FigmaSettingsSection } from './workspace-settings/FigmaSettingsSection';
import { ModelApiSettingsSection } from './workspace-settings/ModelApiSettingsSection';
import { PresetOptionsSection } from './workspace-settings/PresetOptionsSection';

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
      <DialogContent className="h-[min(640px,calc(100vh-32px))] w-[min(680px,calc(100vw-32px))] max-w-[680px] border-[#303753] bg-[#101421] shadow-[0_32px_120px_rgba(0,0,0,0.48)]">
        <DialogHeader className="px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#3B456D] bg-[#182038] text-[#B8C4FF]">
              <Settings2 className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[17px] leading-6">Workspace Settings</DialogTitle>
              <div className="mt-0.5 text-xs leading-4 text-[#8F98B8]">Configure conversion defaults and runtime credentials.</div>
            </div>
          </div>
          <DialogDescription className="sr-only">Configure workspace settings.</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" type="button" className="size-8 rounded-lg">
              <X className="size-4 text-[#9CA3AF]" />
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
          <DialogBody className="min-h-0 flex-1 overflow-hidden p-0">
            <div className="min-h-0 overflow-y-auto custom-scrollbar bg-[#111626]">
              <div className="px-6 py-5">
                <PresetOptionsSection
                  framework={framework}
                  onFrameworkChange={setFramework}
                  stylingSystem={stylingSystem}
                  onStylingSystemChange={setStylingSystem}
                />

                <FigmaSettingsSection
                  inputRef={figmaTokenInputRef}
                  token={figmaTokenDraft}
                  invalid={figmaTokenInvalid}
                  maskedTextStyle={maskedTextStyle}
                  onTokenChange={setFigmaTokenDraft}
                  onTouched={setFigmaTokenTouched}
                />

                <ModelApiSettingsSection
                  endpointInputRef={modelApiEndpointInputRef}
                  apiKeyInputRef={modelApiKeyInputRef}
                  endpoint={apiEndpoint}
                  apiKey={apiKey}
                  modelName={modelNameDraft}
                  aiEnhance={aiEnhanceDraft}
                  endpointInvalid={modelApiEndpointInvalid}
                  apiKeyInvalid={modelApiKeyInvalid}
                  maskedTextStyle={maskedTextStyle}
                  onEndpointChange={setApiEndpoint}
                  onApiKeyChange={setApiKey}
                  onModelNameChange={setModelNameDraft}
                  onAiEnhanceChange={setAiEnhanceDraft}
                  onEndpointTouched={setModelApiEndpointTouched}
                  onApiKeyTouched={setModelApiKeyTouched}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="bg-[#0D111C] px-5 py-4">
            <Button variant="ghost" type="button" onClick={onClose} className="rounded-lg">
              Cancel
            </Button>
            <Button type="submit" className="rounded-lg bg-[#3558FF] px-4 hover:bg-[#2F4FE6]">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
