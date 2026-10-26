"use client";

import type { CSSProperties } from "react";
import {
  standingsResultChromeStyle,
  type VintageStandingsContent,
} from "@/lib/vintage/standingsContent";

type TileStatus = "correct" | "incorrect" | "pending";

/**
 * Placeholder Final Four / Champ tile for admin sizing & chrome previews.
 */
function PreviewTile({
  label,
  status,
  border,
  finalist,
  champ,
}: {
  label: string;
  status: TileStatus;
  border?: TileStatus;
  finalist?: boolean;
  champ?: boolean;
}) {
  const className = [
    "ve-admin-preview__tile",
    champ ? "ve-admin-preview__tile--champ" : "",
    finalist ? "ve-admin-preview__tile--finalist" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={className}
      data-status={status}
      data-border={finalist ? border ?? "pending" : undefined}
      aria-hidden
    >
      {label}
    </span>
  );
}

/**
 * Three-row standings preview driven by current logo / shade / border CMS.
 */
export function StandingsLogoSizingPreview({
  content,
}: {
  content: VintageStandingsContent;
}) {
  const style = standingsResultChromeStyle(content) as CSSProperties;
  const rows = [
    {
      rank: 1,
      name: "Sample Entry A",
      pts: 142,
      ff: [
        { label: "UNC", status: "correct" as const },
        { label: "Gonz", status: "correct" as const },
        { label: "Ore", status: "incorrect" as const },
        { label: "SC", status: "pending" as const },
      ],
      champ: {
        label: "UNC",
        status: "correct" as const,
        border: "correct" as const,
      },
    },
    {
      rank: 2,
      name: "Sample Entry B",
      pts: 132,
      ff: [
        { label: "Duke", status: "incorrect" as const },
        { label: "Gonz", status: "correct" as const },
        { label: "KU", status: "incorrect" as const },
        { label: "UNC", status: "correct" as const },
      ],
      champ: {
        label: "UNC",
        status: "correct" as const,
        border: "correct" as const,
      },
    },
    {
      rank: 3,
      name: "Sample Entry C",
      pts: 127,
      ff: [
        { label: "Vill", status: "pending" as const },
        { label: "Az", status: "incorrect" as const },
        { label: "Ore", status: "correct" as const },
        { label: "UK", status: "incorrect" as const },
      ],
      champ: {
        label: "Gonz",
        status: "incorrect" as const,
        border: "incorrect" as const,
      },
    },
  ];

  return (
    <div
      className="ve-admin-preview"
      style={style}
      data-testid="standings-logo-sizing-preview"
    >
      <p className="ve-admin-preview__title">Live preview (3 sample rows)</p>
      <table className="ve-admin-preview-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Entry</th>
            <th>Pts</th>
            <th>Final Four</th>
            <th>Champ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rank}>
              <td>{row.rank}</td>
              <td>{row.name}</td>
              <td className="ve-admin-preview__pts">{row.pts}</td>
              <td>
                <div className="ve-admin-preview__ff">
                  {row.ff.map((cell, i) => (
                    <PreviewTile
                      key={`${row.rank}-ff-${i}`}
                      label={cell.label}
                      status={cell.status}
                      finalist={i === 1 || i === 3}
                      border={
                        i === 1 ? "correct" : i === 3 ? "pending" : undefined
                      }
                    />
                  ))}
                </div>
              </td>
              <td>
                <PreviewTile
                  label={row.champ.label}
                  status={row.champ.status}
                  border={row.champ.border}
                  finalist
                  champ
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Reference image + live swatches for result shade colors.
 */
export function StandingsResultShadePreview({
  content,
}: {
  content: VintageStandingsContent;
}) {
  const style = standingsResultChromeStyle(content) as CSSProperties;
  return (
    <div
      className="ve-admin-preview"
      style={style}
      data-testid="standings-result-shade-preview"
    >
      <p className="ve-admin-preview__title">Shade reference</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ve-admin-preview__ref-img"
        src="/vintage/admin-result-shade-sample.svg"
        alt="Reference: correct green fill, incorrect red fill, pending white fill"
        width={420}
        height={120}
      />
      <div className="ve-admin-preview__samples">
        {(
          [
            ["Correct", "correct"],
            ["Incorrect", "incorrect"],
            ["Pending", "pending"],
          ] as const
        ).map(([label, status]) => (
          <div className="ve-admin-preview__sample" key={status}>
            <PreviewTile label="FF" status={status} />
            <span className="ve-admin-preview__sample-label">
              Live · {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Reference image + live swatches for result border colors.
 */
export function StandingsResultBorderPreview({
  content,
}: {
  content: VintageStandingsContent;
}) {
  const style = standingsResultChromeStyle(content) as CSSProperties;
  return (
    <div
      className="ve-admin-preview"
      style={style}
      data-testid="standings-result-border-preview"
    >
      <p className="ve-admin-preview__title">Border reference</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ve-admin-preview__ref-img"
        src="/vintage/admin-result-border-sample.svg"
        alt="Reference: correct green frame, incorrect red frame, pending black frame"
        width={420}
        height={120}
      />
      <div className="ve-admin-preview__samples">
        {(
          [
            ["Correct", "correct"],
            ["Incorrect", "incorrect"],
            ["Pending", "pending"],
          ] as const
        ).map(([label, border]) => (
          <div className="ve-admin-preview__sample" key={border}>
            <PreviewTile
              label="FF"
              status="pending"
              finalist
              border={border}
              champ
            />
            <span className="ve-admin-preview__sample-label">
              Live · {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
