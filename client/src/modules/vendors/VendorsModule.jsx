import { Routes, Route } from 'react-router-dom';
import VendorsPage from './VendorsPage';
import VendorLedgerPage from './VendorLedgerPage';

export default function VendorsModule() {
  return (
    <Routes>
      <Route index element={<VendorsPage />} />
      <Route path=":id" element={<VendorLedgerPage />} />
    </Routes>
  );
}
