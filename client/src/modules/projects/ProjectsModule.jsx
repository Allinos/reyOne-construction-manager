import { Routes, Route } from 'react-router-dom';
import ProjectsListPage from './ProjectsListPage';
import MyProjectsPage from './MyProjectsPage';
import ProjectDetailPage from './ProjectDetailPage';
import ProjectFormPage from './ProjectFormPage';
import { useAuth } from '../../context/AuthContext';

// Self-contained routing for the Projects module (mounted at /projects/*).
// Managers (can create) get the full management list; other assigned users
// (employees, site engineers) get their card-based "My Projects" panel.
export default function ProjectsModule() {
  const { can } = useAuth();
  const IndexPage = can('projects.create') ? ProjectsListPage : MyProjectsPage;
  return (
    <Routes>
      <Route index element={<IndexPage />} />
      <Route path="new" element={<ProjectFormPage />} />
      <Route path=":id" element={<ProjectDetailPage />} />
      <Route path=":id/edit" element={<ProjectFormPage />} />
    </Routes>
  );
}
