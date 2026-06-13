import { FeatureProvider } from '@/features/workspace/providers/featureFlags';
import { closeFile, openFile } from '@/features/workspace/services/workspaceService';
import { useEditorStore } from '@/features/workspace/store/editorStore';
import { Navigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useFileTreeActions } from "@/features/fileTree";
import { WorkbenchHeader } from "@/features/workbench";
import { useState } from "react";
import { EditorPane, PreviewPane, SidebarPane, Topbar } from '@/features/workbench';




export function EditorPage() {
  const { roomId } = useParams()
  const fileTreeActions = useFileTreeActions();
  const { activeFile, openFiles } = useEditorStore(
    useShallow((state) => ({
      activeFile: state.activeFile,
      openFiles: state.openFiles,
    }))
  );
  const [previewRevision, setPreviewRevision] = useState(0);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  if (!roomId) return <Navigate to="/" replace />

  return (
    <FeatureProvider features={{ fileTree: true, toolbar: false }}>
      <div className="h-screen w-screen flex flex-col bg-gray-900">
        <Topbar />

        <WorkbenchHeader
          activeFile={activeFile}
          openFiles={openFiles}
          onOpenFile={openFile}
          onCloseFile={closeFile}
          onNewFile={() => fileTreeActions.handleStartCreate(null, "file")}
          onNewFolder={() => fileTreeActions.handleStartCreate(null, "folder")}
          onPreviewRefresh={() => setPreviewRevision((value) => value + 1)}
          onPreviewFullscreenToggle={() => setIsPreviewFullscreen((value) => !value)}
          isPreviewFullscreen={isPreviewFullscreen}
        />

        <div className="flex flex-1 overflow-hidden relative border-t border-[#2a2f4c]">
          {!isPreviewFullscreen && <SidebarPane fileTreeActions={fileTreeActions} />}

          {!isPreviewFullscreen && <EditorPane key="editor" roomId={roomId} />}

          <PreviewPane key={`preview:${previewRevision}`} isFullscreen={isPreviewFullscreen} />
        </div>
      </div>
    </FeatureProvider>
  );
}
