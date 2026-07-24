import { Routes, Route } from 'react-router-dom';
import ClientsPage from './ClientsPage';
import ClientProfilePage from './ClientProfilePage';

export default function ClientsModule() {
  return (
    <Routes>
      <Route index element={<ClientsPage />} />
      <Route path=":id" element={<ClientProfilePage />} />
    </Routes>
  );
}
