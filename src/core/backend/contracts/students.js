import { defineBackendContract } from "../contract";

export const STUDENT_METHODS = [
  "getUniversities",
  "getUniversityById",
  "setStudentInterest",
  "getStudentInterests",
  "getStudentRecommendations",
];

export const studentRepositoryContract = defineBackendContract(
  "StudentRepository",
  STUDENT_METHODS
);
