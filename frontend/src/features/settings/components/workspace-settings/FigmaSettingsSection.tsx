import type { CSSProperties, RefObject } from 'react';
import { Input } from '@/ui/input';
import { cn } from '@/utils/cn';
import { Field, SectionHeading } from './SettingsField';

interface FigmaSettingsSectionProps {
  inputRef: RefObject<HTMLInputElement | null>;
  token: string;
  invalid: boolean;
  maskedTextStyle: CSSProperties;
  onTokenChange: (value: string) => void;
  onTouched: (touched: boolean) => void;
}

export function FigmaSettingsSection({
  inputRef,
  token,
  invalid,
  maskedTextStyle,
  onTokenChange,
  onTouched,
}: FigmaSettingsSectionProps) {
  return (
    <section className="border-b border-[#29314C] py-5">
      <SectionHeading title="Figma" description="Connect the source file exporter with a personal access token." />
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
