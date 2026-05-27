import type { ReactNode } from 'react';
import { Label } from '@/ui/label';

export function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="text-[13px] font-semibold uppercase leading-5 tracking-[0.12em] text-[#E6E9F5]">{title}</div>
      <div className="mt-1 text-xs leading-5 text-[#8F98B8]">{description}</div>
    </div>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-medium text-[#AEB7D0]">{label}</Label>
      {children}
      {error && <div className="text-[11px] leading-4 text-red-400">{error}</div>}
    </div>
  );
}
