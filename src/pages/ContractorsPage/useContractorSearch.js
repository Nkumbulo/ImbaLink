import { useMemo, useState } from "react";
import { setContractorLike } from "../../core/data/domains/interactions.js";
import { createQuoteRequest } from "../../core/data/domains/quotes.js";

export function useContractorSearch({ contractors, setLiked, setMessagesState, setTab }) {
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          contractors
            .map((contractor) => contractor?.category)
            .filter(Boolean)
        )
      ),
    ];
  }, [contractors]);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return contractors.filter((contractor) => {
      if (!contractor) return false;

      const text = [
        contractor.name,
        contractor.business,
        contractor.category,
        contractor.area,
        contractor.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !normalizedQuery || text.includes(normalizedQuery);
      const matchesCategory = category === "All" || contractor.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [contractors, query, category]);

  const toggleLike = (id) => {
    const key = String(id);

    setLiked?.((current) => {
      const next = new Set(current || []);
      const willLike = !next.has(key);

      if (willLike) {
        next.add(key);
      } else {
        next.delete(key);
      }

      setContractorLike(key, willLike).catch((error) => {
        console.error("Failed to update contractor like:", error);
      });

      return next;
    });
  };

  const handleRequestQuote = async (contractor) => {
    if (!contractor) return;

    const contractorName = contractor.business || contractor.name || "Contractor";
    const message = `Quote requested from ImbaLink for ${contractorName}`;

    try {
      await createQuoteRequest({
        contractorId: contractor.id,
        contractorName,
        requesterType: "tenant",
        message,
      });

      setMessagesState?.({
        contractorId: contractor.id,
        contractorName,
        templateMessage: message,
      });

      setTab?.("messages");
    } catch (error) {
      console.error("Failed to request quote:", error);
    }
  };

  const openContractorProfile = (contractor) => {
    if (!contractor) return;
    setSelectedContractor(contractor);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const closeContractorProfile = () => {
    setSelectedContractor(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return {
    showRegistration, setShowRegistration,
    selectedContractor, openContractorProfile, closeContractorProfile,
    query, setQuery, category, setCategory,
    categories, results,
    toggleLike, handleRequestQuote,
  };
}
