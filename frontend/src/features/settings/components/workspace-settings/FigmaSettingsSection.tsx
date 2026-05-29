import type { CSSProperties, RefObject } from 'react';
import { Input } from '@/ui/input';
import { Switch } from '@/ui/switch';
import { cn } from '@/utils/cn';
import { Field, SectionHeading } from './SettingsField';

interface FigmaSettingsSectionProps {
  inputRef: RefObject<HTMLInputElement | null>;
  token: string;
  invalid: boolean;
  useConvertCache: boolean;
  maskedTextStyle: CSSProperties;
  onTokenChange: (value: string) => void;
  onUseConvertCacheChange: (enabled: boolean) => void;
  onTouched: (touched: boolean) => void;
}

export function FigmaSettingsSection({
  inputRef,
  token,
  invalid,
  useConvertCache,
  maskedTextStyle,
  onTokenChange,
  onUseConvertCacheChange,
  onTouched,
}: FigmaSettingsSectionProps) {
  return (
    <section className="border-b border-[#29314C] py-5">
      <div className="flex items-start justify-between gap-4">
        <SectionHeading title="Figma" description="Connect the source file exporter with a personal access token." />
        <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[#303753] bg-[#171C2E] px-3 py-2">
          <span className="text-sm font-semibold leading-5 text-[#E5E7EB]">Use Cache</span>
          <Switch checked={useConvertCache} onCheckedChange={onUseConvertCacheChange} />
        </div>
      </div>
      <div className="mt-4">
        <Field label="Figma Token" error={invalid ? 'Figma Token 是必填项' : undefined}>
          <Input
            type="text"
            ref={inputRef}
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="figd_..."
            autoComplete="off"
            style={maskedTextStyle}
            onBlur={() => onTouched(true)}
            className={cn('border-[#303753] bg-[#171C2E]', invalid && 'border-red-500/70 focus-visible:ring-red-500/40')}
          />
        </Field>
      </div>
    </section>
  );
}
