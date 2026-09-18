/** Legacy compatibility shim. Canonical student persistence now lives in the Supabase backend adapter. */
export { supabaseStudentRepository as studentRepository } from "../../../../infrastructure/supabase/adapters/students";
export {
  getUniversities,
  getUniversityById,
  setStudentInterest,
  getStudentInterests,
  getStudentRecommendations,
} from "../../../../infrastructure/supabase/adapters/students";
