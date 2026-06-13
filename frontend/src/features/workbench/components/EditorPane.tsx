import { Suspense, lazy } from "react";
import { Loading } from '@/ui/Loading';

const LazyEditor = lazy(async () => {
  const mod = await import("@/features/editor");
  return { default: mod.Editor };
});

interface EditorPaneProps {
  roomId: string
}

export function EditorPane({ roomId }: EditorPaneProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden relative">
      <div className="flex-1 overflow-hidden relative">
        <Suspense fallback={<Loading text="正在初始化编辑器..." />}>
          <LazyEditor roomId={roomId} />
        </Suspense>
      </div>
    </div>
  );
}
