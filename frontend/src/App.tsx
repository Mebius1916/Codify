import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./routes/HomeRoute";
import { EditorPage } from "./routes/EditorRoute";
import { AppToaster } from "./ui/appToast";
import { RequireAuth } from "./features/auth";

export default function App() {
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
