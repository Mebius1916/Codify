import figmaIconUrl from '@assets/Figma.svg';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useFigmaUrlParser } from '@/features/figma/hooks/useFigmaUrlParser';
import { ConvertStageMiniStatus } from '@/features/figma/components/ConvertStageMiniStatus';
import { runConvertFlow } from '@/features/figma/services/runConvertFlow';
import { parseFigmaRoomUrl } from '@/features/figma/utils/figmaRoom';
import { showToast } from '@/ui/appToast';
import { formatUnknownError } from '@/utils/errorMessage';

export function SearchBox() {
  const navigate = useNavigate();
  const { state, parse, clearError } = useFigmaUrlParser();
  const [url, setUrl] = useState('');
  const isLoading = state.status === 'loading';
  const stage = state.status === 'loading' ? state.stage : undefined;
  const error = state.status === 'error' ? state.error : null;

  const handleConvert = async () => {
    const result = await parse(url);
    if (result) {
      try {
        const { roomId } = parseFigmaRoomUrl(url);
        await runConvertFlow(result, roomId);
        navigate(`/rooms/${roomId}`);
      } catch (error) {
        showToast({
          title: '转换结果写入失败',
          message: formatUnknownError(error, '转换已完成，但写入编辑器文件时失败，请检查浏览器存储空间或刷新后重试。'),
          variant: 'error',
        });
      }
    }
  };

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl px-4">
      <div className="relative group h-[30px]">
        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <img src={figmaIconUrl} alt="Figma" className="w-4 h-4" />
          )}
        </div>
        <input
          type="text"
          value={url}
          disabled={isLoading}
          onChange={(e) => {
            if (error) clearError();
            setUrl(e.target.value);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
          className={`block w-full h-full pl-10 pr-[80px] bg-[#252526] border rounded-md leading-5 text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all ${
            error ? 'border-red-500 text-red-400' : 'border-[#2a2f4c]'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ backgroundColor: 'rgb(25, 30, 50)' }}
          placeholder={error || "请输入 figma url"}
        />
        <div className="absolute inset-y-0 right-1 my-1 flex items-center">
          <button 
            onClick={handleConvert}
            disabled={isLoading}
            className={`h-full px-3 text-xs font-medium text-white rounded transition-colors ${
              isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-rgb(19, 55, 236) hover:opacity-90'
            }`}
            style={{ backgroundColor: isLoading ? undefined : 'rgb(19, 55, 236)' }}
          >
            {isLoading ? 'Converting...' : 'Convert'}
          </button>
        </div>
      </div>
      {isLoading && (
        <div className="mt-2">
          <ConvertStageMiniStatus stage={stage} />
        </div>
      )}
    </div>
  );
}
