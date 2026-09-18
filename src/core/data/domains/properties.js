export * from '../adapters/properties';


// Keep property interaction callers on the backend boundary.
import { backend } from "../../../application/backend/index.js";
export const setPropertyLike = (...args) => backend.interactionRepository.setPropertyLike(...args);
export const setPropertySave = (...args) => backend.interactionRepository.setPropertySave(...args);
export const recordPropertyView = (...args) => backend.interactionRepository.recordPropertyView(...args);
