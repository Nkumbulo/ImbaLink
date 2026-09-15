import { useCallback } from "react";
import {
  registerAgent as registerAgentApi,
  registerCompany as registerCompanyApi,
  registerContractor as registerContractorApi,
  registerLandlord as registerLandlordApi,
  registerPro as registerProApi,
} from "../core/data/domains/registrations.js";

/**
 * Keeps hub-registration mutations together and enforces the single active
 * hub rule before any write reaches Supabase.
 */
export default function useAppRegistrations({
  activeHubType,
  user,
  setAgentRegistration,
  setCompanyRegistration,
  setContractorRegistrations,
  setLandlordRegistration,
  setProRegistration,
  setHubWelcome,
}) {
  const assertHubAvailable = useCallback((hubType) => {
    if (activeHubType && activeHubType !== hubType) {
      throw new Error(`You're already registered as a ${activeHubType}. Only one hub registration is allowed per account.`);
    }
  }, [activeHubType]);

  const registerContractor = useCallback(async (data) => {
    assertHubAvailable("contractor");
    const record = await registerContractorApi({ ...data, userId: user?.id });
    setContractorRegistrations((current) => [
      record,
      ...current.filter((item) => item.id !== record.id),
    ].slice(0, 1000));
    return record;
  }, [assertHubAvailable, setContractorRegistrations, user?.id]);

  const registerLandlord = useCallback(async (data) => {
    assertHubAvailable("landlord");
    const record = await registerLandlordApi({ ...data, userId: user?.id });
    setLandlordRegistration(record);
    setHubWelcome("landlord");
    return record;
  }, [assertHubAvailable, setHubWelcome, setLandlordRegistration, user?.id]);

  const registerAgent = useCallback(async (data) => {
    assertHubAvailable("agent");
    const record = await registerAgentApi({ ...data, userId: user?.id });
    setAgentRegistration(record);
    return record;
  }, [assertHubAvailable, setAgentRegistration, user?.id]);

  const registerCompany = useCallback(async (data) => {
    assertHubAvailable("company");
    const record = await registerCompanyApi({ ...data, userId: user?.id });
    setCompanyRegistration(record);
    setHubWelcome("company");
    return record;
  }, [assertHubAvailable, setCompanyRegistration, setHubWelcome, user?.id]);

  const registerPro = useCallback(async (data) => {
    const record = await registerProApi({ ...data, userId: user?.id });
    setProRegistration(record);
    return record;
  }, [setProRegistration, user?.id]);

  return {
    registerContractor,
    registerLandlord,
    registerAgent,
    registerCompany,
    registerPro,
  };
}
