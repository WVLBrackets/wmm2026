import Link from "next/link";
export default function HomeViewToggle({
  vintage = false,
}: {
  vintage?: boolean;
}) {
  return (
    <nav
      aria-label="Homepage view"
      className={
        vintage
          ? "v-view-toggle"
          : "flex items-center justify-center gap-3 py-6 text-sm text-gray-600"
      }
      data-testid="home-view-toggle"
    >
      <span>HOMEPAGE EDITION</span>
      <Link
        href="/"
        aria-current={!vintage ? "page" : undefined}
        data-testid="home-view-old"
      >
        Old
      </Link>
      <Link
        href="/vintage"
        aria-current={vintage ? "page" : undefined}
        data-testid="home-view-new"
      >
        New
      </Link>
    </nav>
  );
}
