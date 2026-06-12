import type { CSSProperties, RefObject } from 'react';
import { KeyRound, Link2 } from 'lucide-react';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';
import { cn } from '@/utils/cn';
import { Field, SectionHeading } from './SettingsField';

interface ModelApiSettingsSectionProps {
  endpointInputRef: RefObject<HTMLInputElement | null>;
  apiKeyInputRef: RefObject<HTMLInputElement | null>;
  endpoint: string;
  apiKey: string;
  modelName: string;
  aiEnhance: boolean;
  locked: boolean;
  endpointInvalid: boolean;
  apiKeyInvalid: boolean;
  maskedTextStyle: CSSProperties;
  onEndpointChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelNameChange: (value: string) => void;
  onAiEnhanceChange: (enabled: boolean) => void;
  onEndpointTouched: (touched: boolean) => void;
  onApiKeyTouched: (touched: boolean) => void;
}

export function ModelApiSettingsSection({
  endpointInputRef,
  apiKeyInputRef,
  endpoint,
  apiKey,
  modelName,
  aiEnhance,
  locked,
  endpointInvalid,
  apiKeyInvalid,
  maskedTextStyle,
  onEndpointChange,
  onApiKeyChange,
  onModelNameChange,
  onAiEnhanceChange,
  onEndpointTouched,
  onApiKeyTouched,
}: ModelApiSettingsSectionProps) {
  const disabled = locked || !aiEnhance;
  const disabledClass = disabled ? 'opacity-50' : '';

  return (
    <section className="pt-5">
      <div className="flex items-start justify-between gap-4">
        <SectionHeading
          title="Model API Configuration"
          description="Use your model provider to visually repair generated HTML/CSS."
        />
        <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#303753] bg-[#171C2E] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold leading-5 text-[#E5E7EB]">AI Enhance</span>
            <span className="rounded bg-[#22315C] px-1.5 py-0.5 text-[10px] font-bold leading-4 text-[#AFC0FF]">
              BETA
            </span>
          </div>
          <Switch checked={aiEnhance} disabled={locked} onCheckedChange={onAiEnhanceChange} />
        </div>
      </div>

      <div className={`mt-4 space-y-4 transition-opacity ${disabledClass}`}>
        <Field label="Model API Endpoint URL" error={endpointInvalid ? 'Model API Endpoint 是必填项' : undefined}>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#8F98B8]" />
            <Input
              ref={endpointInputRef}
              value={endpoint}
              onChange={(e) => onEndpointChange(e.target.value)}
              disabled={disabled}
              placeholder="https://your-llm-api.example/v1"
              autoComplete="off"
              onBlur={() => onEndpointTouched(true)}
              aria-invalid={endpointInvalid}
              className={cn(
                'border-[#303753] bg-[#171C2E] pl-9',
                endpointInvalid && 'border-red-500/70 focus-visible:ring-red-500/40',
              )}
            />
          </div>
        </Field>

        <Field label="Model">
          <Input
            value={modelName}
            onChange={(e) => onModelNameChange(e.target.value)}
            disabled={disabled}
            placeholder="gpt-4o"
            autoComplete="off"
            className="border-[#303753] bg-[#171C2E]"
          />
        </Field>

        <Field label="Model API Key" error={apiKeyInvalid ? 'Model API Key 是必填项' : undefined}>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#8F98B8]" />
            <Input
              type="text"
              ref={apiKeyInputRef}
              value={locked ? 'Configured on server' : apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              disabled={disabled}
              autoComplete="off"
              style={locked ? undefined : maskedTextStyle}
              onBlur={() => onApiKeyTouched(true)}
              aria-invalid={apiKeyInvalid}
              className={cn(
                'border-[#303753] bg-[#171C2E] pl-9',
                apiKeyInvalid && 'border-red-500/70 focus-visible:ring-red-500/40',
              )}
            />
          </div>
        </Field>
      </div>
    </section>
  );
}
