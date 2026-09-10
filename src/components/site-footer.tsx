export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="text-muted mx-auto max-w-6xl px-4 py-6 text-sm">
        <p data-testid="footer-note">
          Sokoni is a demonstration storefront built as the system under test for a QA automation
          portfolio. No real orders are fulfilled and no real payments are taken.
        </p>
        <p className="mt-2">Free delivery on orders over KSh 5,000. Nairobi and countrywide.</p>
      </div>
    </footer>
  );
}
