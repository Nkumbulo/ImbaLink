import React, { useMemo, useState } from "react";
import { ArrowRight, Plus, Search, ShieldCheck, ShoppingBag } from "lucide-react";
import { commerceCategories, demoProducts } from "../commerceData";
import CommerceCard from "../components/CommerceCard";

export default function CommerceHomePage({ setTab, onSwitchMode, savedIds, onToggleSave, onMessage }) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const products = useMemo(() => demoProducts.filter((p) =>
    (category === "All" || p.category === category) &&
    (!query.trim() || `${p.title} ${p.category} ${p.location}`.toLowerCase().includes(query.toLowerCase()))
  ), [category, query]);

  return (
    <div className="commerce-page web-page">
      <section className="commerce-hero">
        <div className="commerce-hero-top">
          <div>
            <div className="commerce-kicker"><ShoppingBag size={15} /> ImbaLink Marketplace</div>
            <h1>Buy from people.<br /><span>Sell to people.</span></h1>
            <p>Anyone can buy. Anyone can sell. ImbaLink simply helps people find and connect with each other.</p>
          </div>
          <button type="button" className="commerce-mode-switch" onClick={onSwitchMode}>Property</button>
        </div>
        <div className="commerce-search">
          <Search size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search things people are selling" aria-label="Search marketplace" />
          <button type="button" onClick={() => setTab("sell")}><Plus size={16} /> Sell</button>
        </div>
        <div className="commerce-categories" role="tablist" aria-label="Marketplace categories">
          {commerceCategories.map((item) => <button key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      </section>

      <section className="commerce-content">
        <div className="commerce-section-heading">
          <div><span className="commerce-eyebrow">Marketplace</span><h2>{query ? "Search results" : "Fresh listings"}</h2></div>
          <button type="button" onClick={() => setTab("search")}>Explore all <ArrowRight size={15} /></button>
        </div>
        <div className="commerce-safety"><ShieldCheck size={18} /><div><b>Stay safe</b><span>Verify the item and seller before paying. Never share passwords, OTPs or banking PINs. ImbaLink does not guarantee transactions.</span></div></div>
        <div className="commerce-grid">{products.map((product) => <CommerceCard key={product.id} product={product} saved={savedIds.has(product.id)} onToggleSave={onToggleSave} onMessage={onMessage} />)}</div>
      </section>
    </div>
  );
}
