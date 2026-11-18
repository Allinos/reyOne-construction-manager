import { Routes, Route } from 'react-router-dom';
import DocumentsPage from './DocumentsPage';

export default function DocumentsModule() {
  return (
    <Routes>
      <Route index element={<DocumentsPage />} />
    </Routes>
  );
}
