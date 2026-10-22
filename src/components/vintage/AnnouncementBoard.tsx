"use client";

import { Megaphone } from "lucide-react";
import {
  formatAnnouncementAt,
  type VintageAnnouncementBoard,
} from "@/lib/vintage/content";
import VintageEditGear from "./VintageEditGear";

/**
 * Full-width announcements board under the explore band.
 * Title aligns with explore-card headlines; each line is date/time + message.
 */
export default function AnnouncementBoard({
  board,
  admin = false,
}: {
  board: VintageAnnouncementBoard;
  admin?: boolean;
}) {
  if (!board.enabled) return null;

  const title = board.title.trim() || "ANNOUNCEMENTS";
  const items = [...board.items].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at),
  );

  return (
    <section
      className="v-announce-board"
      aria-label={title}
      data-testid="vintage-announce-board"
    >
      {admin ? (
        <VintageEditGear
          focus={{ kind: "announcements" }}
          testId="vintage-edit-gear-announcements"
          label="Edit announcements"
        />
      ) : null}
      <div className="v-announce-panel">
        <div className="v-announce-icon" aria-hidden="true">
          <Megaphone size={36} strokeWidth={1.6} />
        </div>
        <div className="v-announce-body">
          <h2 data-testid="vintage-announce-title">{title}</h2>
          {items.length ? (
            <ul className="v-announce-list">
              {items.map((item) => {
                const when = formatAnnouncementAt(item.at);
                return (
                  <li
                    key={item.id}
                    className="v-announce-item"
                    data-testid={`vintage-announce-item-${item.id}`}
                  >
                    <time dateTime={item.at}>{when || "—"}</time>
                    <p>{item.text}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="v-announce-empty" data-testid="vintage-announce-empty">
              No announcements yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
