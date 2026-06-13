import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./routes/HomeRoute";
import { EditorPage } from "./routes/EditorRoute";
import { AppToaster } from "./ui/appToast";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/rooms/:roomId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AppToaster />
    </>
  );
}
