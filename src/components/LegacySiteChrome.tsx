"use client";
import NavigationWrapper from "./NavigationWrapper";
import Footer from "./Footer";

/** The original site's navigation and footer, shared by its existing routes. */
export default function LegacySiteChrome({
  children,
  buildStamp,
}: {
  children: React.ReactNode;
  buildStamp: string;
}) {
  return (
    <>
      <NavigationWrapper />
      <main>{children}</main>
      <Footer buildStamp={buildStamp} />
    </>
  );
}
