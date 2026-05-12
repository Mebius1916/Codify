import { openFile } from '@/features/workspace/services/workspaceService'
import { useFeatures } from '@/features/workspace/providers/featureFlags'
import { useEditorStore } from '@/features/workspace/store/editorStore'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFileTreeData, useFileTreeResizeCssVars, useFileTreeActions } from '../hooks'
import type { FileTreeNodeData } from '../interfaces/contracts'
import { FileTreeNode } from './FileTreeNode'
import { NewFileItem } from './NewFileItem'
import { FileTreeHeader } from './FileTreeHeader'
import downloadIconUrl from '@assets/Download.svg'
import { downloadAllFilesAsZip } from '../utils/downloadAll'

type FileTreeActions = ReturnType<typeof useFileTreeActions>

interface FileTreePanelProps {
  actions?: FileTreeActions
  showHeader?: boolean
}

export function FileTreePanel({ actions, showHeader }: FileTreePanelProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const { fileKeys, activeFile } = useEditorStore(
    useShallow((state) => ({
      fileKeys: state.fileKeys,
      activeFile: state.activeFile,
    }))
  )
  const { fileTree: isEnabled, toolbar: isToolbarEnabled } = useFeatures()
  const { onMouseDown, onMouseEnter, onMouseLeave, handleStyle } = useFileTreeResizeCssVars()
  const internalActions = useFileTreeActions()

  const { fileTree, handleFolderToggle } = useFileTreeData(fileKeys)

  const {
    creatingState,
    renamingState,
    handleConfirmCreate,
    handleCancelCreate,
    handleConfirmRename,
    setRenamingState,
  } = actions ?? internalActions

  if (isEnabled === false) {
    return null
  }

  const shouldShowHeader = showHeader ?? (isToolbarEnabled === false)

  const handleDownloadAll = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const { files, fileKeys } = useEditorStore.getState()
      await downloadAllFilesAsZip({ files, fileKeys, zipName: 'project.zip' })
    } catch (error) {
      console.error(error)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex h-full relative group">
      <div className="h-full flex flex-col" style={{ width: '100%', backgroundColor: 'rgb(15, 17, 25)' }}>
        {shouldShowHeader && (
          <FileTreeHeader/>
        )}

        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          {creatingState?.parentPath === null && (
            <NewFileItem
              depth={0}
              type={creatingState.type}
              onCommit={handleConfirmCreate}
              onCancel={handleCancelCreate}
            />
          )}

          {fileTree.map((node: FileTreeNodeData) => (
            <FileTreeNode
              key={node.id}
              node={node}
              depth={0}
              activeFile={activeFile}
              creatingState={creatingState}
              renamingState={renamingState}
              onFileClick={openFile}
              onFolderToggle={handleFolderToggle}
              onConfirmCreate={handleConfirmCreate}
              onCancelCreate={handleCancelCreate}
              onConfirmRename={handleConfirmRename}
              onCancelRename={() => setRenamingState(null)}
            />
          ))}
        </div>

        <div className="w-full p-3 bg-[#131620] border-t border-[#2A2F4C] flex flex-col items-start">
          <button
            type="button"
            disabled={isDownloading}
            className="w-full px-3 py-2 bg-[#1A1E32] rounded outline outline-1 outline-[#2A2F4C] -outline-offset-1 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDownloadAll}
          >
            <div className="flex flex-col items-center">
              {isDownloading ? (
                <div className="h-[10px] w-[10px] rounded-full border border-[#D1D5DB]/40 border-t-[#D1D5DB] animate-spin" />
              ) : (
                <img src={downloadIconUrl} alt="" className="w-[8.15px] h-[9.93px]" />
              )}
            </div>
            <div className="text-center text-[#D1D5DB] text-xs leading-4 font-medium font-['Inter']">
              {isDownloading ? 'Downloading...' : 'Download All'}
            </div>
          </button>
        </div>
      </div>

      <div
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20 transition-colors"
        style={handleStyle}
      />
    </div>
  )
}
