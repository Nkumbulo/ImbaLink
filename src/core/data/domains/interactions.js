export * from '../adapters/interactions';


// Interaction writes use the application backend boundary. The remaining
// exports above are legacy read/workflow compatibility paths and are migrated
// separately to avoid changing their established behavior.
import { backend } from "../../../application/backend/index.js";

export const setPropertyLike = (...args) => backend.interactionRepository.setPropertyLike(...args);
export const setPropertySave = (...args) => backend.interactionRepository.setPropertySave(...args);
export const recordPropertyView = (...args) => backend.interactionRepository.recordPropertyView(...args);
export const setContractorLike = (...args) => backend.interactionRepository.setContractorLike(...args);
