import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./routes/HomeRoute";
import { EditorPage } from "./routes/EditorRoute";
import { AppToaster } from "./ui/appToast";
import { RequireAuth } from "./features/auth";
import { useWorkspaceSettingsSync } from "./features/settings/hooks/useWorkspaceSettingsSync";

export default function App() {
  useWorkspaceSettingsSync();

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:roomId" element={<RequireAuth><EditorPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AppToaster />
    </>
  );
}
