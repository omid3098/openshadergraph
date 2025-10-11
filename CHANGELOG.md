## [0.5.0-beta.3](https://github.com/omid3098/openshadergraph/compare/v0.5.0-beta.2...v0.5.0-beta.3) (2025-10-11)

- Merge pull request #72 from omid3098/codex/evaluate-argument-in-issue#70
### Bug Fixes

- avoid clipboard prompt and improve save as fallback _(by Omid Saadat)_ ([12ac530]())

## [0.5.0-beta.2](https://github.com/omid3098/openshadergraph/compare/v0.5.0-beta.1...v0.5.0-beta.2) (2025-10-11)

- Merge pull request #69 from omid3098/codex/explore-instant-shader-export-functionality
### Features

- add quick export workflow _(by Omid Saadat)_ ([b7e088c]())
### Bug Fixes

- consolidate export menu _(by Omid Saadat)_ ([cd5637d]())

## [0.5.0-beta.1](https://github.com/omid3098/openshadergraph/compare/v0.4.0...v0.5.0-beta.1) (2025-10-10)

- Merge branch 'dev' into beta- Merge pull request #61 from omid3098/codex/update-shader-compiler-to-include-default-values- Merge pull request #62 from omid3098/codex/fix-reversed-matcap-textures-in-godot- Merge pull request #63 from omid3098/codex/implement-lighting-profiles-for-3d-preview- Merge pull request #64 from omid3098/codex/add-voronoi-and-simple-noise-nodes- Merge pull request #65 from omid3098/codex/fix-errors-in-generated-godot-shader- Merge pull request #66 from omid3098/codex/refactor-right-click-context-menu-design
### Chores

- **release:** 0.4.0 _(by semantic-release-bot)_ ([7c01411]())- **release:** 0.4.0-beta.2 _(by semantic-release-bot)_ ([725255e]())- **release:** 0.4.0-beta.3 _(by semantic-release-bot)_ ([e5d67a6]())- **release:** 0.4.0-beta.4 _(by semantic-release-bot)_ ([6ed37bb]())- **release:** 0.4.0-beta.5 _(by semantic-release-bot)_ ([6037131]())- **release:** 0.4.0-beta.6 _(by semantic-release-bot)_ ([aee0339]())- **release:** 0.4.0-beta.7 _(by semantic-release-bot)_ ([8d80984]())- **release:** 0.4.0-beta.8 _(by semantic-release-bot)_ ([a324f4a]())
### Features

- add clipboard-aware paste and vertical stack arrange _(by Omid Saadat)_ ([0f40202]())- add noise graph examples _(by Omid Saadat)_ ([18fc433]())- **arrange:** add horizontal stack distribution _(by Omid Saadat)_ ([75af74a]())- **preview:** add lighting profiles to 3d preview _(by Omid Saadat)_ ([c2ffb8d]())
### Bug Fixes

- **compiler:** include output defaults when features enabled _(by Omid Saadat)_ ([e67943a]())- **coordinates:** synchronize view orientation across languages _(by Omid Saadat)_ ([3a21b2b]())- **godot:** derive view-space orientation from coordinates metadata _(by Omid Saadat)_ ([1ab4fbf]())- **godot:** mirror view transforms for matcap consistency _(by Omid Saadat)_ ([0de5271]())- **godot:** repair voronoi noise shader generation _(by Omid Saadat)_ ([26da787]())- restore vertex defaults for shader outputs _(by Omid Saadat)_ ([044381c]())- reuse engine fragment normal defaults _(by Omid Saadat)_ ([308e033]())- stabilize procedural noise uv wiring _(by Omid Saadat)_ ([5b49160]())- stop clobbering vertex output normals _(by Omid Saadat)_ ([c6f06ff]())- streamline graph context menu _(by Omid Saadat)_ ([c6a0a52]())- **ui:** increase vertical and horizontal stack gaps for better node alignment _(by Omid Saadat)_ ([8ca91bb]())- **ui:** space stacked nodes using measured sizes _(by Omid Saadat)_ ([dfef971]())- **ui:** update vertical and horizontal stack gaps to 5px and 25px for improved node distribution _(by Omid Saadat)_ ([7432136]())- widen horizontal stack spacing _(by Omid Saadat)_ ([bd57ef0]())
### Documentation

- require bun run gates umbrella validation _(by Omid Saadat)_ ([4788177]())

## [0.4.0-beta.8](https://github.com/omid3098/openshadergraph/compare/v0.4.0-beta.7...v0.4.0-beta.8) (2025-10-10)

- Merge pull request #66 from omid3098/codex/refactor-right-click-context-menu-design
### Features

- add clipboard-aware paste and vertical stack arrange _(by Omid Saadat)_ ([0f40202]())- **arrange:** add horizontal stack distribution _(by Omid Saadat)_ ([75af74a]())
### Bug Fixes

- streamline graph context menu _(by Omid Saadat)_ ([c6a0a52]())- **ui:** increase vertical and horizontal stack gaps for better node alignment _(by Omid Saadat)_ ([8ca91bb]())- **ui:** space stacked nodes using measured sizes _(by Omid Saadat)_ ([dfef971]())- **ui:** update vertical and horizontal stack gaps to 5px and 25px for improved node distribution _(by Omid Saadat)_ ([7432136]())- widen horizontal stack spacing _(by Omid Saadat)_ ([bd57ef0]())

## [0.4.0-beta.7](https://github.com/omid3098/openshadergraph/compare/v0.4.0-beta.6...v0.4.0-beta.7) (2025-10-09)

- Merge pull request #65 from omid3098/codex/fix-errors-in-generated-godot-shader
### Bug Fixes

- **godot:** repair voronoi noise shader generation _(by Omid Saadat)_ ([26da787]())

## [0.4.0-beta.6](https://github.com/omid3098/openshadergraph/compare/v0.4.0-beta.5...v0.4.0-beta.6) (2025-10-09)

### Features

- add noise graph examples _(by Omid Saadat)_ ([18fc433]())

## [0.4.0-beta.5](https://github.com/omid3098/openshadergraph/compare/v0.4.0-beta.4...v0.4.0-beta.5) (2025-10-09)

- Merge pull request #64 from omid3098/codex/add-voronoi-and-simple-noise-nodes
### Bug Fixes

- stabilize procedural noise uv wiring _(by Omid Saadat)_ ([5b49160]())
### Documentation

- require bun run gates umbrella validation _(by Omid Saadat)_ ([4788177]())

## [0.4.0-beta.4](https://github.com/omid3098/openshadergraph/compare/v0.4.0-beta.3...v0.4.0-beta.4) (2025-10-09)

- Merge pull request #63 from omid3098/codex/implement-lighting-profiles-for-3d-preview
### Features

- **preview:** add lighting profiles to 3d preview _(by Omid Saadat)_ ([c2ffb8d]())

## [0.4.0-beta.3](https://github.com/omid3098/openshadergraph/compare/v0.4.0-beta.2...v0.4.0-beta.3) (2025-10-09)

- Merge pull request #62 from omid3098/codex/fix-reversed-matcap-textures-in-godot
### Bug Fixes

- **coordinates:** synchronize view orientation across languages _(by Omid Saadat)_ ([3a21b2b]())- **godot:** derive view-space orientation from coordinates metadata _(by Omid Saadat)_ ([1ab4fbf]())- **godot:** mirror view transforms for matcap consistency _(by Omid Saadat)_ ([0de5271]())

## [0.4.0-beta.2](https://github.com/omid3098/openshadergraph/compare/v0.4.0-beta.1...v0.4.0-beta.2) (2025-10-09)

- Merge pull request #61 from omid3098/codex/update-shader-compiler-to-include-default-values
### Chores

- **release:** 0.4.0 _(by semantic-release-bot)_ ([7c01411]())
### Bug Fixes

- **compiler:** include output defaults when features enabled _(by Omid Saadat)_ ([e67943a]())- restore vertex defaults for shader outputs _(by Omid Saadat)_ ([044381c]())- reuse engine fragment normal defaults _(by Omid Saadat)_ ([308e033]())- stop clobbering vertex output normals _(by Omid Saadat)_ ([c6f06ff]())

## [0.4.0](https://github.com/omid3098/openshadergraph/compare/v0.3.0...v0.4.0) (2025-10-08)

- Merge branch 'dev' into beta- Merge pull request #59 from omid3098/codex/implement-ambientcg-api-integration- Merge pull request #60 from omid3098/beta
### Chores

- **release:** 0.2.0-beta.2 _(by semantic-release-bot)_ ([a5f6267]())- **release:** 0.2.0-beta.3 _(by semantic-release-bot)_ ([9f187f9]())- **release:** 0.4.0-beta.1 _(by semantic-release-bot)_ ([667b5d9]())
### Features

- integrate ambientcg asset library _(by Omid Saadat)_ ([778bfd2]())- streamline ambientcg defaults and manual assets _(by Omid Saadat)_ ([5702c33]())
### Bug Fixes

- **data:** update fragment output node labels to indicate WIP status _(by Omid Saadat)_ ([f6a8254]())
### Performance Improvements

- **ambientcg:** paginate provider catalog _(by Omid Saadat)_ ([de08bb5]())

## [0.4.0-beta.1](https://github.com/omid3098/openshadergraph/compare/v0.3.0...v0.4.0-beta.1) (2025-10-08)

- Merge branch 'dev' into beta- Merge pull request #59 from omid3098/codex/implement-ambientcg-api-integration
### Chores

- **release:** 0.2.0-beta.2 _(by semantic-release-bot)_ ([a5f6267]())- **release:** 0.2.0-beta.3 _(by semantic-release-bot)_ ([9f187f9]())
### Features

- integrate ambientcg asset library _(by Omid Saadat)_ ([778bfd2]())- streamline ambientcg defaults and manual assets _(by Omid Saadat)_ ([5702c33]())
### Bug Fixes

- **data:** update fragment output node labels to indicate WIP status _(by Omid Saadat)_ ([f6a8254]())
### Performance Improvements

- **ambientcg:** paginate provider catalog _(by Omid Saadat)_ ([de08bb5]())

## [0.2.0-beta.3](https://github.com/omid3098/openshadergraph/compare/v0.2.0-beta.2...v0.2.0-beta.3) (2025-10-08)

### Bug Fixes

- **data:** update fragment output node labels to indicate WIP status _(by Omid Saadat)_ ([f6a8254]())

## [0.2.0-beta.2](https://github.com/omid3098/openshadergraph/compare/v0.2.0-beta.1...v0.2.0-beta.2) (2025-10-07)

- Merge pull request #56 from omid3098/codex/add-container-with-background-for-breadcrumbs- Merge pull request #57 from omid3098/codex/add-minimalist-about-me-section
### Features

- **ui:** add about section to settings page _(by Omid Saadat)_ ([e886e41]())
### Bug Fixes

- **ui:** update About Me section in SettingsPage to reflect personal statement _(by Omid Saadat)_ ([36045e8]())
### Styles

- **app:** emphasize breadcrumb container _(by Omid Saadat)_ ([5fd3701]())

## [0.2.0-beta.1](https://github.com/omid3098/openshadergraph/compare/v0.1.0...v0.2.0-beta.1) (2025-10-07)

### Chores

- add conventional-changelog-conventionalcommits dependency _(by Omid Saadat)_ ([a428e8e]())- add deploy environment to versioning, update version to 0.3.3, and include deploy info in App component display _(by Omid Saadat)_ ([9d67c68]())- bump version to 0.2.0 and update commit details; regenerate build date _(by Omid Saadat)_ ([acec3ed]())- bump version to 0.3.0 and update commit details; regenerate build date _(by Omid Saadat)_ ([c85c14a]())- refactor versioning logic to remove git dependency, enhance environment variable support for versioning, and adjust git tagging behavior to be opt-in; bump version to 0.3.5 _(by Omid Saadat)_ ([13a0168]())- refactor versioning logic to use committed src/version.ts as the single source of truth, removing git dependency and simplifying version retrieval _(by Omid Saadat)_ ([dbe1000]())- remove audit report file to streamline documentation and focus on essential project resources _(by Omid Saadat)_ ([4366599]())- remove outdated E2E testing workflow from GitHub Actions, streamlining CI configuration and eliminating redundancy in testing processes _(by Omid Saadat)_ ([fd22657]())- remove unnecessary borderRadius property from cardRingVars in GraphNode component to streamline styling _(by Omid Saadat)_ ([5cd1b62]())- reset version to 0.1.0, clear commit hash, update build date, and mark as clean build _(by Omid Saadat)_ ([476c2cb]())- update docs _(by Omid Saadat)_ ([830ebda]())- update ESLint configuration to ignore .venv directory, enhance contributing documentation with handle helper guidelines, refactor App component to centralize input value updates, and bump version to 0.3.2 with updated commit details _(by Omid Saadat)_ ([d0915b1]())- update ESLint rules to enforce stricter checks, enhance Vitest configuration for TSX tests, and bump version to 0.3.1 with updated commit details _(by Omid Saadat)_ ([2c743a2]())- update README title and regenerate build date to reflect latest changes _(by Omid Saadat)_ ([db2d386]())- update README with note on versioning bump workflow and increment version to 0.3.4 with new build date _(by Omid Saadat)_ ([5ffa53f]())- update version to 0.2.0, set commit hash to d83cd78e, update build date, and mark as dirty build _(by Omid Saadat)_ ([6308d0e]())- update version to 0.3.4, enhance versioning logic to support environment-specific deployment, and adjust App component to display version without leading 'v' _(by Omid Saadat)_ ([c1b0097]())
- Add Matcap example graph- Ensure gates build dist and update engine metadata- Fix caret jumping in note and texture node inputs- Fix ThreeJS preview projection uniform and add shader error e2e coverage- Merge pull request #45 from omid3098/mkdocs- Merge pull request #47 from omid3098/codex/run-bun-run-gates-and-fix-errors- Merge pull request #48 from omid3098/codex/update-e2e-tests-to-catch-shader-crashes- Merge pull request #49 from omid3098/codex/fix-unused-variables-in-generated-shader- Merge pull request #50 from omid3098/codex/create-matcap-graph-in-ben-cloward-examples- Merge pull request #51 from omid3098/codex/remove-drag-and-drop-for-texture-node- Merge pull request #52 from omid3098/codex/fix-input-field-cursor-behavior- Merge pull request #54 from omid3098/codex/implement-semantic-release-for-versioning- remove audit.md- Remove committed artifacts directory- Trim extra blank lines after camera output pruning- Update AGENTS.md for clarity on local validation requirements and enhance ThreeJS_GLSL templates for shader compatibility- Update docs:dev script to kill existing process on port before starting mkdocs server- Update matcap.json example graph by repositioning nodes, modifying connections, and adding a new texture node for UV Grid. This enhances the graph's structure and visual output capabilities.
### ThreeJS

- use texture() in samplers/triplanar for WebGL2 compatibility _(by Omid Saadat)_ ([e6d77d4]())
### Features

- add 'Expose Name' property to color and float nodes for custom uniform naming _(by Omid Saadat)_ ([4628aff]())- add alignment and distribution functionalities in GraphContextMenu and App components for improved node arrangement and user experience _(by Omid Saadat)_ ([ad22e3a]())- Add camera handling templates to Godot and ThreeJS_GLSL language packs _(by Omid Saadat)_ ([b5833da]())- add deploy label management in build process to enhance versioning and deployment tracking _(by Omid Saadat)_ ([53ad758]())- Add distance fade example _(by Omid Saadat)_ ([9620010]())- add documentation build support with MkDocs; enhance README and server routes for serving docs _(by Omid Saadat)_ ([0e35a9b]())- add drop shadow effect to selected edges in the graph for improved visual distinction and user experience _(by Omid Saadat)_ ([88c955e]())- Add export functionality and getting started documentation _(by Omid Saadat)_ ([6459892]())- add gates script to package.json for validation process _(by Omid Saadat)_ ([4a8d065]())- add interaction area to ColoredEdge component for improved user interaction and edge selection _(by Omid Saadat)_ ([af35a01]())- add mkdocs-glightbox plugin and update documentation to utilize lightbox for image display, enhancing visual presentation in 'Getting Started' guide _(by Omid Saadat)_ ([6097fab]())- add more example graphs _(by Omid Saadat)_ ([3f9b12f]())- add reroute node functionality with template and rendering support in GraphNode component for enhanced graph manipulation _(by Omid Saadat)_ ([7f9598c]())- add vertex normal mask example graph _(by Omid Saadat)_ ([d67cd9d]())- add workflow step to download build artifacts for CI process, ensuring access to distribution files for subsequent jobs _(by Omid Saadat)_ ([84e7079]())- Enhance Bevy WGSL language pack and graph compiler for improved shader generation _(by Omid Saadat)_ ([d3d442e]())- enhance build process to support automatic git tagging; update versioning to reflect new app version and commit details _(by Omid Saadat)_ ([dbd365d]())- enhance build process with Python dependency resolution for MkDocs and improve documentation build handling _(by Omid Saadat)_ ([d14dad9]())- enhance E2E testing setup with detailed instructions for Chromium installation and configuration, update Playwright project settings for improved browser handling, and refine documentation for better clarity on testing processes _(by Omid Saadat)_ ([e98d056]())- enhance graph history management by introducing snapshot capturing and queuing for node mutations, improving undo/redo functionality _(by Omid Saadat)_ ([6101d8e]())- enhance GraphNode component styling with improved border radius and overflow handling for better visual consistency _(by Omid Saadat)_ ([1c370ee]())- enhance GraphNode component with improved drag-and-drop functionality for better user interaction and node arrangement _(by Omid Saadat)_ ([a905a66]())- Enhance Playwright configuration and shader compilation tests _(by Omid Saadat)_ ([84f8404]())- Enhance ThreeJS_GLSL language pack and graph compiler for improved shader handling _(by Omid Saadat)_ ([90a4a5e]())- enhance ThreeJS_GLSL language templates and improve GraphNode component with probe widget support for better user experience and customization _(by Omid Saadat)_ ([37623c7]())- enhance versioning logic to support GitHub API for commit message fetching and improve CI compatibility; add fetchJSON utility for API calls _(by Omid Saadat)_ ([b57a9a5]())- exclude Playwright e2e tests from Vitest configuration to streamline test execution and avoid conflicts with existing test setups _(by Omid Saadat)_ ([934e263]())- Expand Bevy WGSL, Godot, and ThreeJS_GLSL language packs with enhanced position handling _(by Omid Saadat)_ ([d5ea6a9]())- expand documentation structure by adding 'Getting Started', 'Features', and 'Tutorials' sections, enhancing user onboarding and resource accessibility _(by Omid Saadat)_ ([39477fe]())- implement auto-fit functionality for viewport on view path change, enhancing user experience by automatically adjusting the view to visible nodes _(by Omid Saadat)_ ([15811c6]())- implement default pass layout computation for improved node positioning in the graph, enhancing visual organization and user experience _(by Omid Saadat)_ ([8594571]())- implement history management for graph actions, enabling undo/redo functionality and enhancing user interaction with graph editing _(by Omid Saadat)_ ([913abab]())- implement node duplication and clipboard functionalities in App and GraphContextMenu for enhanced user experience and graph manipulation _(by Omid Saadat)_ ([565bc7f]())- implement quick node hotkeys management in App and Settings components for enhanced user customization and graph interaction _(by Omid Saadat)_ ([f8e936c]())- implement theme and curve mode settings in App component for enhanced user customization and experience _(by Omid Saadat)_ ([215c086]())- integrate hotkey functionality for graph editing, enhancing user experience with customizable key bindings _(by Omid Saadat)_ ([077440e]())- Introduce new types and capabilities in language packs for Godot and ThreeJS_GLSL _(by Omid Saadat)_ ([98a8785]())- refine getting started documentation with improved clarity on graph types and navigation tips for enhanced user experience _(by Omid Saadat)_ ([2041739]())- refine GraphNode component styling with updated ring colors and offsets for improved visual feedback during selection _(by Omid Saadat)_ ([e8c40bf]())- Remove Bevy WGSL language pack and related compile script _(by Omid Saadat)_ ([b47a9a8]())- revamp getting started documentation to improve clarity and user guidance for shader material creation, including enhanced navigation and workflow instructions _(by Omid Saadat)_ ([aae2365]())- update 'Getting Started' documentation to focus on creating materials and enhance navigation with new sections and mermaid diagrams for better clarity _(by Omid Saadat)_ ([faf891f]())- Update AGENTS.md and package.json for enhanced validation and new script _(by Omid Saadat)_ ([974f2db]())- update dependencies and enhance testing setup with Playwright integration, improve .gitignore for test artifacts, and add toast notifications for better user feedback _(by Omid Saadat)_ ([aad6745]())- update Godot language template to enhance sheen rendering with new implementation and remove deprecated properties for improved shader output _(by Omid Saadat)_ ([b46a5ed]())- update GraphNode component with larger handle size and improved ring styling for enhanced user interaction and visual clarity _(by Omid Saadat)_ ([6b95700]())- update project metadata and dependencies, enhance test coverage configuration, and improve documentation for better user guidance and contribution clarity _(by Omid Saadat)_ ([ecb55a2]())- Update shader templates and enhance testing for improved functionality _(by Omid Saadat)_ ([bb0eeba]())- update TypeScript configuration for improved compatibility and flexibility, disable strict options for practical use, and enhance node handling in App component for better drag and resize functionality _(by Omid Saadat)_ ([41af430]())- update Vitest configuration to include source files for coverage and adjust coverage thresholds for improved test reporting _(by Omid Saadat)_ ([bc1ce9b]())
### Bug Fixes

- adjust spacing for inline default-value widgets in GraphNode component to improve layout and visibility _(by Omid Saadat)_ ([e64b218]())- avoid duplicate app deploy export _(by Omid Saadat)_ ([2f895cd]())- bump patch _(by Omid Saadat)_ ([c1ff42f]())- flood requests on documentation panel opening _(by Omid Saadat)_ ([53ed29d]())- improve context menu interaction in graph creation tests by using bounding box for click position and increasing timeout for selector wait _(by Omid Saadat)_ ([b91f8b0]())- improve versioning logic to dynamically resolve branch for commit message fetching from GitHub API; ensure fallback to default branch and handle edge cases for HEAD SHA retrieval _(by Omid Saadat)_ ([ffa4ef8]())- stabilize deploy export metadata _(by Omid Saadat)_ ([3619dd2]())- update error handling in server routes to use void 0 for ignored errors; add polyfill for HTMLIFrameElement in tests to prevent instanceof errors _(by Omid Saadat)_ ([4e7ae4d]())- Update validation commands in AGENTS.md and package.json _(by Omid Saadat)_ ([a498763]())
### Documentation

- add footer navigation feature to mkdocs configuration for improved documentation accessibility _(by Omid Saadat)_ ([e6c5bbc]())- adjust example graph loading path; enhance examples handling in server to dynamically load example graphs from the filesystem _(by Omid Saadat)_ ([b450447]())- enhance getting-started.md with additional graph types and improve viewer.tsx for breadcrumb navigation and controls integration _(by Omid Saadat)_ ([64a56d9]())- expand AGENTS.md with detailed agent validation and automation requirements; enhance App.tsx to prevent rendering of empty nodes and improve error handling in server routes _(by Omid Saadat)_ ([5019595]())- modify getting-started.md to replace iframes with buttons for example graphs; enhance App.tsx to integrate a documentation panel with resizing functionality _(by Omid Saadat)_ ([b34cfd3]())- remove outdated contributing, features, and tutorials documentation; update developers.md to reflect current setup and testing instructions _(by Omid Saadat)_ ([80a4be3]())- update AGENTS.md for clarity on required gates and enhance viewer.tsx for improved node handling and error management _(by Omid Saadat)_ ([f819867]())- update AGENTS.md to clarify production and development build processes, including automatic git tagging and version regeneration details _(by Omid Saadat)_ ([954ccb2]())- update AGENTS.md to include coverage requirements and modify vitest.config.ts to exclude viewer shell and heavy preview panel from global coverage gates _(by Omid Saadat)_ ([a3d4112]())- update DocumentationPanel and server routes to use internal documentation path, enhancing security and simplifying routing for in-app documentation access _(by Omid Saadat)_ ([bddd61e]())- viewer embedding parameters and examples, update getting-started.md to streamline iframe usage, and improve viewer.tsx for better node management and interaction _(by Omid Saadat)_ ([79b32e7]())
### Tests

- cover godot camera output pruning _(by Omid Saadat)_ ([d83c925]())
### Build System

- auto-bump from package.json changes; docs tweak _(by Omid Saadat)_ ([d83cd78]())
### Continuous Integration

- add release dry-run workflow _(by Omid Saadat)_ ([bdecadf]())- update release configuration for dev and beta branches _(by Omid Saadat)_ ([0ef7880]())

# Changelog

All notable changes to this project will be documented in this file automatically by
[Semantic Release](https://semantic-release.gitbook.io/semantic-release/).

> The changelog is generated from conventional commit messages. Remember to follow the
> format when committing so new releases can be detected correctly.
