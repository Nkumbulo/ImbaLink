import { defineBackendContract } from "../contract";

export const STORAGE_METHODS = ["upload", "remove", "getUrl"];

export const storageContract = defineBackendContract("Storage", STORAGE_METHODS);
