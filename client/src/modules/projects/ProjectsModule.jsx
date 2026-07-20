import { Routes, Route } from 'react-router-dom';
import ProjectsListPage from './ProjectsListPage';
import ProjectDetailPage from './ProjectDetailPage';
import ProjectFormPage from './ProjectFormPage';

// Self-contained routing for the Projects module (mounted at /projects/*).
export default function ProjectsModule() {
  return (
    <Routes>
      <Route index element={<ProjectsListPage />} />
      <Route path="new" element={<ProjectFormPage />} />
      <Route path=":id" element={<ProjectDetailPage />} />
      <Route path=":id/edit" element={<ProjectFormPage />} />
    </Routes>
  );
}
