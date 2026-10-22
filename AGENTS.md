# Repository guidance for coding agents

## UI and design work

For public UI, bracket UI, admin workflow presentation, or visual-asset changes, read [the design system](docs/DESIGN_SYSTEM.md) and its applicable family/component section first. Use [the change checklist](docs/design-system/CHANGE_CHECKLIST.md); consult the [token reference](docs/design-system/tokens.json) and [asset register](docs/design-system/ASSETS.md) when relevant.

The design reference is current staging, including its published CMS content and selected images. The v1 document is a proposal pending Warren’s review; distinguish its intended standards from observed implementation. Do not use it to make unrelated styling changes or replace unverified published artwork with a bundled fallback.

Prefer shared components and existing role tokens. Document new variants and intentional deviations. Preserve the requested scope, functional behavior, scoring, authentication, data sources, and environment/publishing boundaries. A UI request does not authorize deploying or merging to production.

For non-UI changes, consult design guidance only when the change affects presentation. Follow any more specific instructions in the relevant directory.
