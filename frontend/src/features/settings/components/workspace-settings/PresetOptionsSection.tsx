import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Field, SectionHeading } from './SettingsField';

interface PresetOptionsSectionProps {
  framework: string;
  onFrameworkChange: (value: string) => void;
  stylingSystem: string;
  onStylingSystemChange: (value: string) => void;
}

export function PresetOptionsSection({
  framework,
  onFrameworkChange,
  stylingSystem,
  onStylingSystemChange,
}: PresetOptionsSectionProps) {
  return (
    <section className="border-b border-[#29314C] pb-5">
      <SectionHeading title="Preset Options" description="Locked defaults for generated code output." />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Framework">
          <Select value={framework} onValueChange={onFrameworkChange}>
            <SelectTrigger disabled className="border-[#303753] bg-[#171C2E]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HTML + CSS">HTML + CSS</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Styling System">
          <Select value={stylingSystem} onValueChange={onStylingSystemChange}>
            <SelectTrigger disabled className="border-[#303753] bg-[#171C2E]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CSS">CSS</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </section>
  );
}
