import { Route, Routes } from 'react-router-dom';
import { ItineraryPage } from '../features/itinerary/ItineraryPage';
import { HomePage } from '../features/home/HomePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/new" element={<HomePage initialSection="new-plan" />} />
      <Route path="/plans" element={<HomePage initialSection="saved-plans" />} />
      <Route path="/plans/:planId" element={<ItineraryPage />} />
    </Routes>
  );
}
